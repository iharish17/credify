import { PDFDocument, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { ValidationError } from "../utils/errors.js";
import { DEFAULT_FONT_KEY, getFontSource } from "../utils/fontConfig.js";
import fsp from "node:fs/promises";

const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
]);

export function validateTemplateMimeType(mimeType) {
  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    throw new ValidationError(
      "Template must be a PDF, PNG, or JPG/JPEG file."
    );
  }
}

export async function createCertificatePdf({
  templateBuffer,
  templateMimeType,
  participantName,
  x,
  y,
  fontSize,
  fontKey = DEFAULT_FONT_KEY,
  textColor = "#16324f",
  certificateId,
  certificateIdX,
  certificateIdY,
  certificateIdFontSize = 18,
  certificateIdFontKey = DEFAULT_FONT_KEY,
  certificateIdTextColor = "#16324f",
  qrPayload,
  qrX,
  qrY,
  qrSize = 88,
}) {
  validateTemplateMimeType(templateMimeType);

  if (templateMimeType === "application/pdf") {
    return drawOnPdfTemplate({
      templateBuffer,
      participantName,
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
    });
  }

  return drawOnImageTemplate({
    templateBuffer,
    templateMimeType,
    participantName,
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
  });
}

async function drawOnPdfTemplate({
  templateBuffer,
  participantName,
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
}) {
  const pdfDoc = await PDFDocument.load(templateBuffer);
  const [page] = pdfDoc.getPages();

  if (!page) {
    throw new ValidationError("Template PDF must contain at least one page.");
  }

  const font = await embedFont(pdfDoc, fontKey);
  const pageHeight = page.getHeight();
  const textHeight = font.heightAtSize(fontSize, { descender: false });
  const color = toPdfColor(textColor);

  page.drawText(participantName, {
    x,
    y: Math.max(0, pageHeight - y - textHeight),
    size: fontSize,
    font,
    color,
  });

  if (certificateId) {
    const certificateIdFont = await embedFont(pdfDoc, certificateIdFontKey);
    const certificateIdHeight = certificateIdFont.heightAtSize(certificateIdFontSize, {
      descender: false,
    });

    page.drawText(certificateId, {
      x: certificateIdX,
      y: Math.max(0, pageHeight - certificateIdY - certificateIdHeight),
      size: certificateIdFontSize,
      font: certificateIdFont,
      color: toPdfColor(certificateIdTextColor),
    });
  }

  await drawQrCode({
    pdfDoc,
    page,
    pageHeight,
    qrPayload,
    qrX,
    qrY,
    qrSize,
  });

  return pdfDoc.save();
}

async function drawOnImageTemplate({
  templateBuffer,
  templateMimeType,
  participantName,
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
}) {
  const pdfDoc = await PDFDocument.create();
  const image =
    templateMimeType === "image/png"
      ? await pdfDoc.embedPng(templateBuffer)
      : await pdfDoc.embedJpg(templateBuffer);
  const page = pdfDoc.addPage([image.width, image.height]);
  const font = await embedFont(pdfDoc, fontKey);
  const textHeight = font.heightAtSize(fontSize, { descender: false });
  const color = toPdfColor(textColor);

  page.drawImage(image, {
    x: 0,
    y: 0,
    width: image.width,
    height: image.height,
  });

  page.drawText(participantName, {
    x,
    y: Math.max(0, image.height - y - textHeight),
    size: fontSize,
    font,
    color,
  });

  if (certificateId) {
    const certificateIdFont = await embedFont(pdfDoc, certificateIdFontKey);
    const certificateIdHeight = certificateIdFont.heightAtSize(certificateIdFontSize, {
      descender: false,
    });

    page.drawText(certificateId, {
      x: certificateIdX,
      y: Math.max(0, image.height - certificateIdY - certificateIdHeight),
      size: certificateIdFontSize,
      font: certificateIdFont,
      color: toPdfColor(certificateIdTextColor),
    });
  }

  await drawQrCode({
    pdfDoc,
    page,
    pageHeight: image.height,
    qrPayload,
    qrX,
    qrY,
    qrSize,
  });

  return pdfDoc.save();
}

async function drawQrCode({
  pdfDoc,
  page,
  pageHeight,
  qrPayload,
  qrX,
  qrY,
  qrSize,
}) {
  if (!qrPayload) {
    return;
  }

  const qrPng = await QRCode.toBuffer(qrPayload, {
    type: "png",
    width: 512,
    margin: 1,
    color: {
      dark: "#16324f",
      light: "#ffffff",
    },
  });

  const qrImage = await pdfDoc.embedPng(qrPng);

  page.drawImage(qrImage, {
    x: qrX,
    y: Math.max(0, pageHeight - qrY - qrSize),
    width: qrSize,
    height: qrSize,
  });
}

function toPdfColor(hexColor) {
  const clean = hexColor.replace("#", "");

  if (clean.length !== 6) {
    return rgb(0.086, 0.196, 0.31);
  }

  const red = Number.parseInt(clean.slice(0, 2), 16) / 255;
  const green = Number.parseInt(clean.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(clean.slice(4, 6), 16) / 255;

  return rgb(red, green, blue);
}

async function embedFont(pdfDoc, fontKey) {
  const fontSource = getFontSource(fontKey);

  if (fontSource.type === "standard") {
    return pdfDoc.embedFont(fontSource.name);
  }

  if (fontSource.type === "file") {
    const [fontkit, fontBytes] = await Promise.all([
      import("@pdf-lib/fontkit").then((mod) => mod.default),
      fsp.readFile(fontSource.path),
    ]);
    pdfDoc.registerFontkit(fontkit);
    return pdfDoc.embedFont(fontBytes);
  }

  return pdfDoc.embedFont(getFontSource(DEFAULT_FONT_KEY).name);
}
