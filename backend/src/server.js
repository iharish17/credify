import cors from "cors";
import express from "express";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import morgan from "morgan";
import multer from "multer";
import {
  createCertificatePdf,
  validateTemplateMimeType,
} from "./services/certificateService.js";
import { parseParticipantNames } from "./services/csvService.js";
import { HttpError, ValidationError } from "./utils/errors.js";
import {
  createZipArchive,
  ensureDir,
  removeDir,
  safeFileName,
} from "./utils/fileSystem.js";
import { DEFAULT_FONT_KEY, parseFontKey } from "./utils/fontConfig.js";
import { createBatchStore } from "./utils/batchStore.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

const PORT = Number.parseInt(process.env.PORT ?? "4000", 10);
const TEMP_ROOT = path.join(os.tmpdir(), "bulk-certificate-generator");
const BATCH_METADATA_FILE_NAME = "batch-metadata.json";
const TEMPLATE_ROOT = path.resolve(__dirname, "../storage/templates");
const TEMPLATE_METADATA_PATH = path.join(TEMPLATE_ROOT, "templates.json");
const BATCH_TTL_MS = 30 * 60 * 1000;
const CPU_COUNT =
  typeof os.availableParallelism === "function"
    ? os.availableParallelism()
    : os.cpus().length;
const CONCURRENCY = Math.max(2, Math.min(8, Math.floor(CPU_COUNT / 2) || 4));

const batches = createBatchStore({
  ttlMs: BATCH_TTL_MS,
  cleanupIntervalMs: 10 * 60 * 1000,
  onExpire: async (batch) => {
    if (batch.batchDir) {
      await removeDir(batch.batchDir);
    }
  },
});

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "bulk-certificate-generator",
  });
});

app.get("/api/templates/participants.csv", (_req, res) => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="participants-template.csv"'
  );
  res.send("Name\nAlex Johnson\nPriya Sharma\nChris Evans\n");
});

app.get("/api/templates", async (_req, res, next) => {
  try {
    const templates = await listTemplates();
    res.json({ templates });
  } catch (error) {
    next(error);
  }
});

app.get("/api/templates/:templateId", async (req, res, next) => {
  try {
    const templates = await readTemplateMetadata();
    const template = templates.find((item) => item.id === req.params.templateId);

    if (!template) {
      throw new HttpError("Template not found.", 404);
    }

    res.json(serializeTemplate(template));
  } catch (error) {
    next(error);
  }
});

app.get("/api/templates/:templateId/download", async (req, res, next) => {
  try {
    const templates = await readTemplateMetadata();
    const template = templates.find((item) => item.id === req.params.templateId);

    if (!template) {
      throw new HttpError("Template not found.", 404);
    }

    const filePath = path.join(TEMPLATE_ROOT, template.storedFileName);

    if (!fs.existsSync(filePath)) {
      throw new HttpError("Template file is no longer available.", 410);
    }

    res.download(filePath, template.originalName, (error) => {
      if (error) {
        next(error);
      }
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/templates/:templateId/file", async (req, res, next) => {
  try {
    const templates = await readTemplateMetadata();
    const template = templates.find((item) => item.id === req.params.templateId);

    if (!template) {
      throw new HttpError("Template not found.", 404);
    }

    const filePath = path.join(TEMPLATE_ROOT, template.storedFileName);

    if (!fs.existsSync(filePath)) {
      throw new HttpError("Template file is no longer available.", 410);
    }

    res.type(template.mimeType);
    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
});

app.post("/api/templates", upload.single("template"), async (req, res, next) => {
  try {
    const templateFile = req.file;

    if (!templateFile) {
      throw new ValidationError("Template file is required.");
    }

    validateTemplateMimeType(templateFile.mimetype);

    const category = parseTemplateCategory(req.body.category ?? "General");
    const name = parseTemplateName(
      req.body.name ||
        path.parse(templateFile.originalname).name ||
        `Template ${new Date().toISOString().slice(0, 10)}`
    );

    const templateId = randomUUID();
    const extension =
      path.extname(templateFile.originalname).toLowerCase() ||
      inferTemplateExtension(templateFile.mimetype);
    const storedFileName = `${templateId}${extension}`;
    const filePath = path.join(TEMPLATE_ROOT, storedFileName);

    await fsp.writeFile(filePath, templateFile.buffer);

    const record = {
      id: templateId,
      name,
      category,
      originalName: templateFile.originalname,
      mimeType: templateFile.mimetype,
      size: templateFile.size,
      storedFileName,
      createdAt: Date.now(),
    };

    const templates = await readTemplateMetadata();
    templates.push(record);
    await writeTemplateMetadata(templates);

    res.status(201).json({ template: serializeTemplate(record) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/templates/:templateId", async (req, res, next) => {
  try {
    const templates = await readTemplateMetadata();
    const templateIndex = templates.findIndex(
      (item) => item.id === req.params.templateId
    );

    if (templateIndex === -1) {
      throw new HttpError("Template not found.", 404);
    }

    const [template] = templates.splice(templateIndex, 1);
    const filePath = path.join(TEMPLATE_ROOT, template.storedFileName);

    await fsp.rm(filePath, { force: true });
    await writeTemplateMetadata(templates);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/batches",
  upload.fields([
    { name: "template", maxCount: 1 },
    { name: "csv", maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const templateFile = req.files?.template?.[0];
      const csvFile = req.files?.csv?.[0];

      if (!templateFile || !csvFile) {
        throw new ValidationError("Template file and CSV file are both required.");
      }

      validateTemplateMimeType(templateFile.mimetype);

      if (!csvFile.originalname.toLowerCase().endsWith(".csv")) {
        throw new ValidationError("Please upload a valid CSV file.");
      }

      const x = parseNumberField(req.body.x, "X coordinate");
      const y = parseNumberField(req.body.y, "Y coordinate");
      const fontSize = parseNumberField(req.body.fontSize ?? "32", "Font size");
      const fontKey = parseFontKey(req.body.fontKey ?? DEFAULT_FONT_KEY);
      const textColor = parseColorField(req.body.textColor ?? "#16324f");
      const certificateIdPrefix = parseCertificateIdPrefix(
        req.body.certificateIdPrefix ?? "CERT"
      );
      const certificateIdStart = parseIntegerField(
        req.body.certificateIdStart ?? "1001",
        "Certificate ID start"
      );
      const certificateIdX = parseNumberField(
        req.body.certificateIdX ?? req.body.x,
        "Certificate ID X coordinate"
      );
      const certificateIdY = parseNumberField(
        req.body.certificateIdY ?? req.body.y,
        "Certificate ID Y coordinate"
      );
      const certificateIdFontSize = parseNumberField(
        req.body.certificateIdFontSize ?? "18",
        "Certificate ID font size"
      );
      const certificateIdFontKey = parseFontKey(
        req.body.certificateIdFontKey ?? DEFAULT_FONT_KEY
      );
      const certificateIdTextColor = parseColorField(
        req.body.certificateIdTextColor ?? "#16324f"
      );
      const qrX = parseNumberField(req.body.qrX ?? "640", "QR X coordinate");
      const qrY = parseNumberField(req.body.qrY ?? "300", "QR Y coordinate");
      const qrSize = parseNumberField(req.body.qrSize ?? "88", "QR size");

      const batchId = randomUUID();
      const batchDir = path.join(TEMP_ROOT, batchId);
      const certificatesDir = path.join(batchDir, "certificates");
      const zipPath = path.join(batchDir, "certificates.zip");
      const templateExtension =
        path.extname(templateFile.originalname).toLowerCase() ||
        inferTemplateExtension(templateFile.mimetype);
      const templateFileName = `template${templateExtension}`;
      const templatePath = path.join(batchDir, templateFileName);
      const csvFileName = "participants.csv";
      const csvPath = path.join(batchDir, csvFileName);

      await ensureDir(certificatesDir);
      await fsp.writeFile(templatePath, templateFile.buffer);
      await fsp.writeFile(csvPath, csvFile.buffer);

      batches.create({
        id: batchId,
        status: "queued",
        progress: 5,
        x,
        y,
        fontSize,
        fontKey,
        textColor,
        certificateIdPrefix,
        certificateIdStart,
        certificateIdX,
        certificateIdY,
        certificateIdFontSize,
        certificateIdFontKey,
        certificateIdTextColor,
        qrX,
        qrY,
        qrSize,
        batchDir,
        certificatesDir,
        zipPath,
        templatePath,
        templateFileName,
        templateMimeType: templateFile.mimetype,
        csvPath,
        csvFileName,
        templateName: templateFile.originalname,
        csvName: csvFile.originalname,
        fontName: fontKey,
        participantCertificates: [],
      });

      void processGenerationBatch({
        batchId,
        templateBuffer: templateFile.buffer,
        templateMimeType: templateFile.mimetype,
        csvBuffer: csvFile.buffer,
        x,
        y,
        fontSize,
        fontKey,
        textColor,
        certificateIdPrefix,
        certificateIdStart,
        certificateIdX,
        certificateIdY,
        certificateIdFontSize,
        certificateIdFontKey,
        certificateIdTextColor,
        qrX,
        qrY,
        qrSize,
        certificatesDir,
        zipPath,
      }).catch((error) => {
        batches.fail(batchId, error.message || "Certificate generation failed.");
      });

      res.status(202).json({
        batchId,
        statusUrl: `/api/batches/${batchId}/status`,
        downloadUrl: `/api/batches/${batchId}/download`,
      });
    } catch (error) {
      next(error);
    }
  }
);

app.get("/api/batches/:batchId/status", (req, res, next) => {
  try {
    const batch = batches.get(req.params.batchId);

    if (!batch) {
      const persistedBatch = readBatchMetadata(req.params.batchId);

      if (!persistedBatch) {
        throw new HttpError("Batch not found.", 404);
      }

      res.json(serializeBatch(persistedBatch));
      return;
    }

    res.json(serializeBatch(batch));
  } catch (error) {
    next(error);
  }
});

app.get("/api/batches/:batchId/template", (req, res, next) => {
  try {
    const batch = batches.get(req.params.batchId);
    const persistedBatch = batch ? null : readBatchMetadata(req.params.batchId);
    const sourceBatch = batch ?? persistedBatch;

    if (!sourceBatch) {
      throw new HttpError("Batch not found.", 404);
    }

    const fallbackTemplatePath = findTemplateFileInBatch(req.params.batchId);
    const templatePath = sourceBatch.templatePath ?? fallbackTemplatePath;

    if (!templatePath || !fs.existsSync(templatePath)) {
      throw new HttpError("Template file is not available for this batch.", 404);
    }

    if (sourceBatch.templateMimeType) {
      res.type(sourceBatch.templateMimeType);
    }

    res.download(
      templatePath,
      sourceBatch.templateName || path.basename(templatePath),
      (error) => {
        if (error) {
          next(error);
        }
      }
    );
  } catch (error) {
    next(error);
  }
});

app.get("/api/batches/:batchId/reedit-config", (req, res, next) => {
  try {
    const batch = batches.get(req.params.batchId);
    const persistedBatch = batch ? null : readBatchMetadata(req.params.batchId);
    const sourceBatch = batch ?? persistedBatch;

    if (!sourceBatch) {
      throw new HttpError("Batch not found.", 404);
    }

    const fallbackTemplatePath = findTemplateFileInBatch(req.params.batchId);
    if (!sourceBatch.templatePath && fallbackTemplatePath) {
      sourceBatch.templatePath = fallbackTemplatePath;
    }

    if (!sourceBatch.templatePath || !fs.existsSync(sourceBatch.templatePath)) {
      throw new HttpError("Template file is not available for re-edit.", 404);
    }

    res.json({
      batchId: sourceBatch.id,
      templateName: sourceBatch.templateName,
      templateUrl: `/api/batches/${sourceBatch.id}/template`,
      csvUrl: `/api/batches/${sourceBatch.id}/csv/download`,
      csvName: sourceBatch.csvName,
      sampleName:
        sourceBatch.participantCertificates?.[0]?.participantName || "Alex Johnson",
      placement: {
        x: sourceBatch.x,
        y: sourceBatch.y,
        fontSize: sourceBatch.fontSize,
        fontKey: sourceBatch.fontKey,
        textColor: sourceBatch.textColor,
        certificateIdPrefix: sourceBatch.certificateIdPrefix,
        certificateIdStart: sourceBatch.certificateIdStart,
        certificateIdX: sourceBatch.certificateIdX,
        certificateIdY: sourceBatch.certificateIdY,
        certificateIdFontSize: sourceBatch.certificateIdFontSize,
        certificateIdFontKey: sourceBatch.certificateIdFontKey,
        certificateIdTextColor: sourceBatch.certificateIdTextColor,
        qrX: sourceBatch.qrX,
        qrY: sourceBatch.qrY,
        qrSize: sourceBatch.qrSize,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/batches/:batchId/participants", (req, res, next) => {
  try {
    const batch = batches.get(req.params.batchId);
    const persistedBatch = batch ? null : readBatchMetadata(req.params.batchId);
    let participants = Array.isArray(batch?.participantCertificates)
      ? batch.participantCertificates
      : Array.isArray(persistedBatch?.participantCertificates)
      ? persistedBatch.participantCertificates
      : [];

    if (!batch && !persistedBatch) {
      participants = listParticipantsFromBatchDirectory(req.params.batchId);
    }

    if (!batch && !persistedBatch && participants.length === 0) {
      throw new HttpError("Batch not found.", 404);
    }

    res.json({
      participants: normalizeParticipantRecords(req.params.batchId, participants),
    });
  } catch (error) {
    next(error);
  }
});

app.get(
  "/api/batches/:batchId/certificates/:certificateFileName/download",
  (req, res, next) => {
    const batch = batches.get(req.params.batchId);
    const persistedBatch = batch ? null : readBatchMetadata(req.params.batchId);

    const requestedFileName = path.basename(req.params.certificateFileName || "");
    const certificateRoot =
      batch?.certificatesDir ??
      persistedBatch?.certificatesDir ??
      getCertificatesDir(req.params.batchId);
    const filePath = path.join(certificateRoot, requestedFileName);

    if (!fs.existsSync(filePath)) {
      next(new HttpError("Certificate not found for this batch.", 404));
      return;
    }

    res.download(filePath, requestedFileName, (error) => {
      if (error) {
        next(error);
      }
    });
  }
);

app.get(
  "/api/batches/:batchId/certificates/:certificateFileName/view",
  (req, res, next) => {
    const batch = batches.get(req.params.batchId);
    const persistedBatch = batch ? null : readBatchMetadata(req.params.batchId);

    const requestedFileName = path.basename(req.params.certificateFileName || "");
    const certificateRoot =
      batch?.certificatesDir ??
      persistedBatch?.certificatesDir ??
      getCertificatesDir(req.params.batchId);
    const filePath = path.join(certificateRoot, requestedFileName);

    if (!fs.existsSync(filePath)) {
      next(new HttpError("Certificate not found for this batch.", 404));
      return;
    }

    res.type("application/pdf");
    res.sendFile(filePath);
  }
);

app.get("/api/batches/:batchId/csv/download", (req, res, next) => {
  try {
    const batch = batches.get(req.params.batchId);
    const persistedBatch = batch ? null : readBatchMetadata(req.params.batchId);
    const sourceBatch = batch ?? persistedBatch;

    if (!sourceBatch) {
      throw new HttpError("Batch not found.", 404);
    }

    const csvPath = sourceBatch.csvPath ?? path.join(getBatchDir(req.params.batchId), "participants.csv");

    if (!fs.existsSync(csvPath)) {
      throw new HttpError("Participant CSV is not available for this batch.", 404);
    }

    res.download(csvPath, sourceBatch.csvName || "participants.csv", (error) => {
      if (error) {
        next(error);
      }
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/batches/:batchId/download", (req, res, next) => {
  const batch = batches.get(req.params.batchId);
  const persistedBatch = batch ? null : readBatchMetadata(req.params.batchId);
  const sourceBatch = batch ?? persistedBatch;

  if (!sourceBatch) {
    next(new HttpError("Batch not found.", 404));
    return;
  }

  if (sourceBatch.status !== "completed" || !sourceBatch.zipPath) {
    next(new HttpError("This ZIP file is not ready yet.", 409));
    return;
  }

  if (!fs.existsSync(sourceBatch.zipPath)) {
    next(new HttpError("This ZIP file is no longer available.", 410));
    return;
  }

  res.download(sourceBatch.zipPath, `certificates-${sourceBatch.id}.zip`, (error) => {
    if (error) {
      next(error);
    }
  });
});

app.get("/api/batches", (req, res, next) => {
  try {
    const limit = parseIntegerField(req.query.limit ?? "20", "Limit");
    const liveBatches = batches
      .listRecent(Math.min(limit, 100))
      .map(serializeBatch);

    const persistedBatches = listPersistedBatches(Math.min(limit, 100)).map(
      serializeBatch
    );

    const mergedById = new Map();

    for (const item of persistedBatches) {
      mergedById.set(item.id, item);
    }

    for (const item of liveBatches) {
      mergedById.set(item.id, item);
    }

    const recentBatches = [...mergedById.values()]
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      .slice(0, Math.min(limit, 100));

    res.json({ batches: recentBatches });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/batches/:batchId", async (req, res, next) => {
  try {
    const removed = batches.remove(req.params.batchId);
    const batchDir = removed?.batchDir ?? getBatchDir(req.params.batchId);

    if (!fs.existsSync(batchDir)) {
      throw new HttpError("Batch not found.", 404);
    }

    await removeDir(batchDir);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

const frontendDist = path.resolve(__dirname, "../../frontend/dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }

    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    res.status(400).json({
      error: "Uploaded files are too large. Please use files under 15 MB.",
    });
    return;
  }

  const statusCode = error.statusCode ?? 500;
  const message =
    error.message ?? "Something went wrong while generating certificates.";

  res.status(statusCode).json({ error: message });
});

await ensureDir(TEMP_ROOT);
await ensureDir(TEMPLATE_ROOT);
await ensureTemplateMetadataFile();

app.listen(PORT, () => {
  console.log(`Bulk Certificate Generator API listening on port ${PORT}`);
});

async function processGenerationBatch({
  batchId,
  templateBuffer,
  templateMimeType,
  csvBuffer,
  x,
  y,
  fontSize,
  fontKey,
  textColor,
  certificateIdPrefix,
  certificateIdStart,
  certificateIdX,
  certificateIdY,
  certificateIdFontSize,
  certificateIdFontKey,
  certificateIdTextColor,
  qrX,
  qrY,
  qrSize,
  fontBuffer,
  certificatesDir,
  zipPath,
}) {
  batches.update(batchId, {
    status: "parsing",
    progress: 7,
  });

  const participantNames = await parseParticipantNames(csvBuffer);
  const participantCertificates = new Array(participantNames.length);

  batches.update(batchId, {
    status: "processing",
    totalCount: participantNames.length,
    processedCount: 0,
    participantCount: participantNames.length,
    progress: 10,
  });

  await runWithConcurrency(participantNames, CONCURRENCY, async (name, index) => {
    const certificateId = buildCertificateId(
      certificateIdPrefix,
      certificateIdStart + index
    );
    const uniqueCode = randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase();
    const qrPayload = `Name: ${name}\nUnique ID: ${uniqueCode}\nCertificate ID: ${certificateId}`;

    const pdfBytes = await createCertificatePdf({
      templateBuffer,
      templateMimeType,
      participantName: name,
      x,
      y,
      fontSize,
      fontKey,
      textColor,
      certificateId,
      certificateIdX,
      certificateIdY,
      certificateIdFontSize,
      certificateIdFontKey,
      certificateIdTextColor,
      qrPayload,
      qrX,
      qrY,
      qrSize,
      fontBuffer,
    });

    const numberedName = `${String(index + 1).padStart(3, "0")}-${safeFileName(
      name
    )}.pdf`;

    await fsp.writeFile(path.join(certificatesDir, numberedName), pdfBytes);
    participantCertificates[index] = {
      index: index + 1,
      participantName: name,
      certificateId,
      fileName: numberedName,
      downloadUrl: buildCertificateDownloadUrl(batchId, numberedName),
      previewUrl: buildCertificatePreviewUrl(batchId, numberedName),
    };
    batches.incrementProcessed(batchId);
  });

  batches.update(batchId, {
    status: "zipping",
    progress: 96,
  });

  await createZipArchive(certificatesDir, zipPath);

  batches.complete(batchId, {
    zipPath,
    participantCertificates: participantCertificates.filter(Boolean),
  });

  writeBatchMetadata({
    id: batchId,
    status: "completed",
    progress: 100,
    processedCount: participantNames.length,
    totalCount: participantNames.length,
    participantCount: participantNames.length,
    x: batches.get(batchId)?.x,
    y: batches.get(batchId)?.y,
    fontSize: batches.get(batchId)?.fontSize,
    fontKey: batches.get(batchId)?.fontKey,
    textColor: batches.get(batchId)?.textColor,
    certificateIdPrefix: batches.get(batchId)?.certificateIdPrefix,
    certificateIdStart: batches.get(batchId)?.certificateIdStart,
    certificateIdX: batches.get(batchId)?.certificateIdX,
    certificateIdY: batches.get(batchId)?.certificateIdY,
    certificateIdFontSize: batches.get(batchId)?.certificateIdFontSize,
    certificateIdFontKey: batches.get(batchId)?.certificateIdFontKey,
    certificateIdTextColor: batches.get(batchId)?.certificateIdTextColor,
    qrX: batches.get(batchId)?.qrX,
    qrY: batches.get(batchId)?.qrY,
    qrSize: batches.get(batchId)?.qrSize,
    templateName: batches.get(batchId)?.templateName,
    templatePath: batches.get(batchId)?.templatePath,
    templateFileName: batches.get(batchId)?.templateFileName,
    templateMimeType: batches.get(batchId)?.templateMimeType,
    csvPath: batches.get(batchId)?.csvPath,
    csvFileName: batches.get(batchId)?.csvFileName,
    csvName: batches.get(batchId)?.csvName,
    error: null,
    batchDir: getBatchDir(batchId),
    certificatesDir,
    zipPath,
    participantCertificates: participantCertificates.filter(Boolean),
    createdAt: batches.get(batchId)?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
    completedAt: Date.now(),
  });
}

async function runWithConcurrency(items, concurrency, worker) {
  let index = 0;
  let firstError = null;

  async function next() {
    while (index < items.length && !firstError) {
      const currentIndex = index;
      index += 1;

      try {
        await worker(items[currentIndex], currentIndex);
      } catch (error) {
        firstError = error;
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => next()
  );

  await Promise.all(workers);

  if (firstError) {
    throw firstError;
  }
}

function parseNumberField(value, label) {
  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ValidationError(`${label} must be a number greater than or equal to 0.`);
  }

  return parsed;
}

function parseColorField(value) {
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value.trim())) {
    throw new ValidationError("Text color must be a valid hex color like #16324f.");
  }

  return value.trim();
}

function parseIntegerField(value, label) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new ValidationError(`${label} must be an integer greater than or equal to 0.`);
  }

  return parsed;
}

function parseCertificateIdPrefix(value) {
  if (typeof value !== "string") {
    throw new ValidationError("Certificate ID prefix must be text.");
  }

  const prefix = value.trim();

  if (!prefix) {
    return "CERT";
  }

  if (prefix.length > 30) {
    throw new ValidationError("Certificate ID prefix must be 30 characters or fewer.");
  }

  if (!/^[a-zA-Z0-9 _-]+$/.test(prefix)) {
    throw new ValidationError(
      "Certificate ID prefix can only contain letters, numbers, spaces, hyphens, or underscores."
    );
  }

  return prefix;
}

function buildCertificateId(prefix, sequenceNumber) {
  const cleanPrefix = String(prefix ?? "").trim().replace(/[\s_-]+$/, "");
  const formattedNumber = String(Math.max(0, sequenceNumber)).padStart(4, "0");

  if (!cleanPrefix) {
    return formattedNumber;
  }

  return `${cleanPrefix}-${formattedNumber}`;
}

function serializeBatch(batch) {
  return {
    id: batch.id,
    status: batch.status,
    progress: batch.progress,
    processedCount: batch.processedCount,
    totalCount: batch.totalCount,
    participantCount: batch.participantCount ?? 0,
    templateName: batch.templateName,
    csvName: batch.csvName,
    participantCertificateCount: Array.isArray(batch.participantCertificates)
      ? batch.participantCertificates.length
      : 0,
    downloadUrl:
      batch.status === "completed" ? `/api/batches/${batch.id}/download` : null,
    error: batch.error ?? null,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
  };
}

function buildCertificateDownloadUrl(batchId, fileName) {
  return `/api/batches/${batchId}/certificates/${encodeURIComponent(
    fileName
  )}/download`;
}

function buildCertificatePreviewUrl(batchId, fileName) {
  return `/api/batches/${batchId}/certificates/${encodeURIComponent(
    fileName
  )}/view`;
}

function getBatchDir(batchId) {
  return path.join(TEMP_ROOT, path.basename(batchId || ""));
}

function getBatchMetadataPath(batchId) {
  return path.join(getBatchDir(batchId), BATCH_METADATA_FILE_NAME);
}

function findTemplateFileInBatch(batchId) {
  const batchDir = getBatchDir(batchId);

  if (!fs.existsSync(batchDir)) {
    return "";
  }

  const files = fs.readdirSync(batchDir);
  const candidate = files.find((name) => /^template\.(pdf|png|jpg|jpeg)$/i.test(name));

  return candidate ? path.join(batchDir, candidate) : "";
}

function getCertificatesDir(batchId) {
  return path.join(getBatchDir(batchId), "certificates");
}

function listParticipantsFromBatchDirectory(batchId) {
  const certificatesDir = getCertificatesDir(batchId);

  if (!fs.existsSync(certificatesDir)) {
    return [];
  }

  return fs
    .readdirSync(certificatesDir)
    .filter((fileName) => fileName.toLowerCase().endsWith(".pdf"))
    .sort()
    .map((fileName, index) => {
      const participantName = deriveParticipantNameFromFile(fileName);

      return {
        index: index + 1,
        participantName,
        certificateId: "-",
        fileName,
        downloadUrl: buildCertificateDownloadUrl(batchId, fileName),
        previewUrl: buildCertificatePreviewUrl(batchId, fileName),
      };
    });
}

function normalizeParticipantRecords(batchId, records) {
  return (records || []).map((record, index) => {
    const fileName = record.fileName || "";

    return {
      index: record.index ?? index + 1,
      participantName: record.participantName || "Participant",
      certificateId: record.certificateId || "-",
      fileName,
      downloadUrl:
        record.downloadUrl || buildCertificateDownloadUrl(batchId, fileName),
      previewUrl: record.previewUrl || buildCertificatePreviewUrl(batchId, fileName),
    };
  });
}

function readBatchMetadata(batchId) {
  const metadataPath = getBatchMetadataPath(batchId);

  if (!fs.existsSync(metadataPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(metadataPath, "utf-8");
    const parsed = JSON.parse(content);

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeBatchMetadata(batchData) {
  try {
    const metadataPath = getBatchMetadataPath(batchData.id);
    fs.writeFileSync(metadataPath, JSON.stringify(batchData, null, 2), "utf-8");
  } catch {
    // Non-fatal: batch generation remains successful even if metadata persistence fails.
  }
}

function listPersistedBatches(limit) {
  if (!fs.existsSync(TEMP_ROOT)) {
    return [];
  }

  const batchDirs = fs
    .readdirSync(TEMP_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const persisted = batchDirs
    .map((batchId) => readBatchMetadata(batchId))
    .filter(Boolean)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  return typeof limit === "number" ? persisted.slice(0, limit) : persisted;
}

function deriveParticipantNameFromFile(fileName) {
  const withoutExtension = fileName.replace(/\.pdf$/i, "");
  const withoutPrefix = withoutExtension.replace(/^\d{3}-/, "");

  return withoutPrefix
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function ensureTemplateMetadataFile() {
  try {
    await fsp.access(TEMPLATE_METADATA_PATH, fs.constants.F_OK);
  } catch {
    await writeTemplateMetadata([]);
  }
}

async function readTemplateMetadata() {
  await ensureTemplateMetadataFile();
  const content = await fsp.readFile(TEMPLATE_METADATA_PATH, "utf-8");

  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeTemplateMetadata(records) {
  await fsp.writeFile(
    TEMPLATE_METADATA_PATH,
    JSON.stringify(records, null, 2),
    "utf-8"
  );
}

async function listTemplates() {
  const templates = await readTemplateMetadata();

  return templates
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(serializeTemplate);
}

function serializeTemplate(template) {
  return {
    id: template.id,
    name: template.name,
    category: template.category,
    originalName: template.originalName,
    mimeType: template.mimeType,
    size: template.size,
    createdAt: template.createdAt,
    previewUrl: `/api/templates/${template.id}/file`,
    downloadUrl: `/api/templates/${template.id}/download`,
  };
}

function parseTemplateName(value) {
  if (typeof value !== "string") {
    throw new ValidationError("Template name must be text.");
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new ValidationError("Template name is required.");
  }

  if (trimmed.length > 80) {
    throw new ValidationError("Template name must be 80 characters or fewer.");
  }

  return trimmed;
}

function parseTemplateCategory(value) {
  if (typeof value !== "string") {
    throw new ValidationError("Template category must be text.");
  }

  const trimmed = value.trim() || "General";

  if (trimmed.length > 40) {
    throw new ValidationError("Template category must be 40 characters or fewer.");
  }

  return trimmed;
}

function inferTemplateExtension(mimeType) {
  if (mimeType === "application/pdf") {
    return ".pdf";
  }

  if (mimeType === "image/png") {
    return ".png";
  }

  return ".jpg";
}

