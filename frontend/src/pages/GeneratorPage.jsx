import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import CertificatePreview from "../components/CertificatePreview";
import FileDropInput from "../components/FileDropInput";
import { DEFAULT_FONT_KEY, FONT_OPTIONS } from "../fontOptions";
import {
  fetchFileFromUrlAsTemplate,
  fetchTemplateAsFile,
} from "../utils/templateHelpers";

const INITIAL_POSITION = {
  x: 308,
  y: 271,
};

const INITIAL_CERTIFICATE_ID_POSITION = {
  x: 45,
  y: 542,
};

const INITIAL_QR_POSITION = {
  x: 541,
  y: 457,
};

export default function GeneratorPage() {
  const [searchParams] = useSearchParams();
  const [templateFile, setTemplateFile] = useState(null);
  const [csvFile, setCsvFile] = useState(null);
  const [position, setPosition] = useState(INITIAL_POSITION);
  const [fontSize, setFontSize] = useState(32);
  const [fontKey, setFontKey] = useState(DEFAULT_FONT_KEY);
  const [sampleName, setSampleName] = useState("Alex Johnson");
  const [textColor, setTextColor] = useState("#16324f");
  const [certificateIdPrefix, setCertificateIdPrefix] = useState("CERT");
  const [certificateIdStart, setCertificateIdStart] = useState(1001);
  const [certificateIdPosition, setCertificateIdPosition] = useState(
    INITIAL_CERTIFICATE_ID_POSITION
  );
  const [certificateIdFontSize, setCertificateIdFontSize] = useState(18);
  const [certificateIdFontKey, setCertificateIdFontKey] =
    useState(DEFAULT_FONT_KEY);
  const [certificateIdTextColor, setCertificateIdTextColor] =
    useState("#16324f");
  const [qrPosition, setQrPosition] = useState(INITIAL_QR_POSITION);
  const [qrSize, setQrSize] = useState(88);
  const [activePlacement, setActivePlacement] = useState("name");
  const [templateMetrics, setTemplateMetrics] = useState(null);
  const [batchId, setBatchId] = useState("");
  const [batchStatus, setBatchStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const templateId = searchParams.get("templateId");

    if (!templateId) {
      return;
    }

    let isCancelled = false;

    const loadTemplate = async () => {
      try {
        const file = await fetchTemplateAsFile(templateId);

        if (isCancelled) {
          return;
        }

        setTemplateFile(file);
        setError("");
        setBatchId("");
        setBatchStatus(null);
      } catch (loadError) {
        if (!isCancelled) {
          setError(loadError.message);
        }
      }
    };

    void loadTemplate();

    return () => {
      isCancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    const reeditBatchId = searchParams.get("batchId");

    if (!reeditBatchId) {
      return;
    }

    let isCancelled = false;

    const loadReeditData = async () => {
      try {
        const response = await fetch(`/api/batches/${reeditBatchId}/reedit-config`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load batch re-edit data.");
        }

        const template = await fetchFileFromUrlAsTemplate(
          data.templateUrl,
          data.templateName || `batch-${reeditBatchId}-template`
        );
        const csv = data.csvUrl
          ? await fetchFileFromUrlAsTemplate(
              data.csvUrl,
              data.csvName || `batch-${reeditBatchId}-participants.csv`
            )
          : null;

        if (isCancelled) {
          return;
        }

        const placement = data.placement || {};
        setTemplateFile(template);
        if (csv) {
          setCsvFile(csv);
        }
        if (data.sampleName) {
          setSampleName(data.sampleName);
        }
        setPosition({
          x: Number(placement.x ?? INITIAL_POSITION.x),
          y: Number(placement.y ?? INITIAL_POSITION.y),
        });
        setFontSize(Number(placement.fontSize ?? 32));
        setFontKey(placement.fontKey || DEFAULT_FONT_KEY);
        setTextColor(placement.textColor || "#16324f");
        setCertificateIdPrefix(placement.certificateIdPrefix || "CERT");
        setCertificateIdStart(Number(placement.certificateIdStart ?? 1001));
        setCertificateIdPosition({
          x: Number(placement.certificateIdX ?? INITIAL_CERTIFICATE_ID_POSITION.x),
          y: Number(placement.certificateIdY ?? INITIAL_CERTIFICATE_ID_POSITION.y),
        });
        setCertificateIdFontSize(Number(placement.certificateIdFontSize ?? 18));
        setCertificateIdFontKey(placement.certificateIdFontKey || DEFAULT_FONT_KEY);
        setCertificateIdTextColor(placement.certificateIdTextColor || "#16324f");
        setQrPosition({
          x: Number(placement.qrX ?? INITIAL_QR_POSITION.x),
          y: Number(placement.qrY ?? INITIAL_QR_POSITION.y),
        });
        setQrSize(Number(placement.qrSize ?? 88));
        setBatchId("");
        setBatchStatus(null);
        setError("");
      } catch (loadError) {
        if (!isCancelled) {
          setError(loadError.message);
        }
      }
    };

    void loadReeditData();

    return () => {
      isCancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    if (!templateMetrics) {
      return;
    }

    setPosition((current) => ({
      x: clamp(current.x, 0, templateMetrics.width),
      y: clamp(current.y, 0, templateMetrics.height),
    }));
    setCertificateIdPosition((current) => ({
      x: clamp(current.x, 0, templateMetrics.width),
      y: clamp(current.y, 0, templateMetrics.height),
    }));
    setQrPosition((current) => ({
      x: clamp(current.x, 0, templateMetrics.width),
      y: clamp(current.y, 0, templateMetrics.height),
    }));
  }, [templateMetrics]);

  useEffect(() => {
    if (!batchId) {
      return undefined;
    }

    let isCancelled = false;
    const intervalId = window.setInterval(fetchStatus, 1000);
    fetchStatus();

    async function fetchStatus() {
      try {
        const response = await fetch(`/api/batches/${batchId}/status`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not fetch Batch status.");
        }

        if (!isCancelled) {
          setBatchStatus(data);
        }

        if (["completed", "failed"].includes(data.status)) {
          window.clearInterval(intervalId);
        }
      } catch (fetchError) {
        if (!isCancelled) {
          setError(fetchError.message);
          window.clearInterval(intervalId);
        }
      }
    }

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [batchId]);

  const progressValue = useMemo(() => {
    if (isSubmitting && !batchStatus) {
      return 8;
    }

    return batchStatus?.progress ?? 0;
  }, [isSubmitting, batchStatus]);

  const canGenerate = templateFile && csvFile && !isSubmitting;
  const canDownload = batchStatus?.status === "completed";

  const resetBatchState = () => {
    setBatchId("");
    setBatchStatus(null);
    setError("");
  };

  const handleGenerate = async (event) => {
    event.preventDefault();

    if (!templateFile || !csvFile) {
      setError("Upload both the template and CSV files before generating.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setBatchId("");
    setBatchStatus(null);

    try {
      const formData = new FormData();
      formData.append("template", templateFile);
      formData.append("csv", csvFile);
      formData.append("x", String(position.x));
      formData.append("y", String(position.y));
      formData.append("fontSize", String(fontSize));
      formData.append("fontKey", fontKey);
      formData.append("textColor", textColor);
      formData.append("certificateIdPrefix", certificateIdPrefix);
      formData.append("certificateIdStart", String(certificateIdStart));
      formData.append("certificateIdX", String(certificateIdPosition.x));
      formData.append("certificateIdY", String(certificateIdPosition.y));
      formData.append("certificateIdFontSize", String(certificateIdFontSize));
      formData.append("certificateIdFontKey", certificateIdFontKey);
      formData.append("certificateIdTextColor", certificateIdTextColor);
      formData.append("qrX", String(qrPosition.x));
      formData.append("qrY", String(qrPosition.y));
      formData.append("qrSize", String(qrSize));

      const response = await fetch("/api/batches", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to start certificate generation.");
      }

      setBatchId(data.batchId);
    } catch (submissionError) {
      setError(submissionError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = () => {
    if (!batchStatus?.downloadUrl) {
      return;
    }

    const link = document.createElement("a");
    link.href = batchStatus.downloadUrl;
    link.download = `certificates-${batchId}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleDownloadCsvTemplate = () => {
    const csvTemplate = "Name\nFirst Name\nSecond Name\nThird Name\nMany More Names";
    const blob = new Blob([csvTemplate], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "participants-template.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <header className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Bulk Certificate Generator</span>
          <h1>Generate hundreds of personalized certificates in one run.</h1>
          <p>
            Upload a certificate template and a CSV file with a <strong>Name</strong>{" "}
            column, position the text visually, and export everything as a ZIP of PDFs.
          </p>
        </div>
        <div className="hero-card">
          <span className="stat-number">
            {batchStatus?.participantCount || "300+"}
          </span>
          <span className="stat-label">participants handled comfortably</span>
          <p>
            Drag the sample name directly on the preview to place it, or fine-tune
            the X and Y coordinates manually.
          </p>
        </div>
      </header>

      <main className="app-grid">
        <section className="panel panel-upload">
          <div className="panel-header">
            <div>
              <span className="panel-kicker">1. Upload</span>
              <h2>Inputs</h2>
            </div>
          </div>

          <div className="upload-grid">
            <FileDropInput
              label="Certificate Template"
              accept=".pdf,.png,.jpg,.jpeg"
              helpText="Use a single-page PDF or image template."
              file={templateFile}
              onFileChange={(file) => {
                setTemplateFile(file);
                resetBatchState();
              }}
            />
            <FileDropInput
              label="Participant CSV"
              accept=".csv"
              helpText='CSV must include a column named "Name".'
              file={csvFile}
              onFileChange={(file) => {
                setCsvFile(file);
                resetBatchState();
              }}
            />
          </div>

          <div className="mapping-card">
            <div>
              <span className="panel-kicker">CSV Template</span>
              <h3>Use the Name column mapping</h3>
              <p>
                The certificate variable <strong>{'{{Participant Name}}'}</strong>{" "}
                is linked directly to the CSV column <strong>Name</strong>.
              </p>
            </div>
            <button
              type="button"
              className="button secondary"
              onClick={handleDownloadCsvTemplate}
            >
              Download CSV Template
            </button>
          </div>

          <div className="controls-grid">
            <label className="field">
              <span>Preview value for {'{{Participant Name}}'}</span>
              <input
                type="text"
                value={sampleName}
                onChange={(event) => setSampleName(event.target.value)}
                placeholder="Participant's Name"
              />
            </label>

            <label className="field">
              <span>X coordinate</span>
              <input
                type="number"
                value={position.x}
                step="0.01"
                min="0"
                max={Math.round(templateMetrics?.width ?? 2000)}
                onChange={(event) =>
                  setPosition((current) => ({
                    ...current,
                    x: Number.parseFloat(event.target.value || "0"),
                  }))
                }
              />
            </label>

            <label className="field">
              <span>Y coordinate</span>
              <input
                type="number"
                value={position.y}
                step="0.01"
                min="0"
                max={Math.round(templateMetrics?.height ?? 2000)}
                onChange={(event) =>
                  setPosition((current) => ({
                    ...current,
                    y: Number.parseFloat(event.target.value || "0"),
                  }))
                }
              />
            </label>

            <label className="field">
              <span>Font size</span>
              <input
                type="number"
                value={fontSize}
                min="8"
                max="120"
                onChange={(event) =>
                  setFontSize(Number.parseFloat(event.target.value || "32"))
                }
              />
            </label>

            <label className="field">
              <span>Font family</span>
              <select
                value={fontKey}
                onChange={(event) => setFontKey(event.target.value)}
              >
                {FONT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Text color</span>
              <div className="color-row">
                <input
                  type="color"
                  value={textColor}
                  className="color-input"
                  onChange={(event) => setTextColor(event.target.value)}
                />
                <input
                  type="text"
                  value={textColor}
                  maxLength="7"
                  readOnly
                />
              </div>
            </label>

            <label className="field">
              <span>Template variable</span>
              <input type="text" value="{{Participant Name}}" readOnly />
            </label>

            <label className="field">
              <span>Certificate ID prefix</span>
              <input
                type="text"
                value={certificateIdPrefix}
                maxLength="30"
                onChange={(event) => setCertificateIdPrefix(event.target.value)}
                placeholder="CERT"
              />
            </label>

            <label className="field">
              <span>Certificate ID starts from</span>
              <input
                type="number"
                value={certificateIdStart}
                min="0"
                step="1"
                onChange={(event) =>
                  setCertificateIdStart(
                    Number.parseInt(event.target.value || "0", 10) || 0
                  )
                }
              />
            </label>

            <label className="field">
              <span>Certificate ID X</span>
              <input
                type="number"
                value={certificateIdPosition.x}
                step="0.01"
                min="0"
                max={Math.round(templateMetrics?.width ?? 2000)}
                onChange={(event) =>
                  setCertificateIdPosition((current) => ({
                    ...current,
                    x: Number.parseFloat(event.target.value || "0"),
                  }))
                }
              />
            </label>

            <label className="field">
              <span>Certificate ID Y</span>
              <input
                type="number"
                value={certificateIdPosition.y}
                step="0.01"
                min="0"
                max={Math.round(templateMetrics?.height ?? 2000)}
                onChange={(event) =>
                  setCertificateIdPosition((current) => ({
                    ...current,
                    y: Number.parseFloat(event.target.value || "0"),
                  }))
                }
              />
            </label>

            <label className="field">
              <span>Certificate ID font size</span>
              <input
                type="number"
                value={certificateIdFontSize}
                min="8"
                max="120"
                onChange={(event) =>
                  setCertificateIdFontSize(
                    Number.parseFloat(event.target.value || "18")
                  )
                }
              />
            </label>

            <label className="field">
              <span>Certificate ID font family</span>
              <select
                value={certificateIdFontKey}
                onChange={(event) => setCertificateIdFontKey(event.target.value)}
              >
                {FONT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Certificate ID color</span>
              <div className="color-row">
                <input
                  type="color"
                  value={certificateIdTextColor}
                  className="color-input"
                  onChange={(event) => setCertificateIdTextColor(event.target.value)}
                />
                <input
                  type="text"
                  value={certificateIdTextColor}
                  maxLength="7"
                  readOnly
                />
              </div>
            </label>

            <label className="field">
              <span>QR X</span>
              <input
                type="number"
                value={qrPosition.x}
                step="0.01"
                min="0"
                max={Math.round(templateMetrics?.width ?? 2000)}
                onChange={(event) =>
                  setQrPosition((current) => ({
                    ...current,
                    x: Number.parseFloat(event.target.value || "0"),
                  }))
                }
              />
            </label>

            <label className="field">
              <span>QR Y</span>
              <input
                type="number"
                value={qrPosition.y}
                step="0.01"
                min="0"
                max={Math.round(templateMetrics?.height ?? 2000)}
                onChange={(event) =>
                  setQrPosition((current) => ({
                    ...current,
                    y: Number.parseFloat(event.target.value || "0"),
                  }))
                }
              />
            </label>

            <label className="field">
              <span>QR size</span>
              <input
                type="number"
                value={qrSize}
                min="20"
                max="300"
                onChange={(event) =>
                  setQrSize(Number.parseFloat(event.target.value || "88"))
                }
              />
            </label>

            <label className="field">
              <span>Click/drag target in preview</span>
              <select
                value={activePlacement}
                onChange={(event) => setActivePlacement(event.target.value)}
              >
                <option value="name">Participant Name</option>
                <option value="certificateId">Certificate ID</option>
                <option value="qr">QR Code</option>
              </select>
            </label>
          </div>

          <div className="helper-copy">
            Coordinates are measured from the top-left of the certificate template.
            The backend converts that into PDF-safe placement automatically. For
            the closest match, place the top-left corner of the preview text exactly
            where you want the final name to begin.
          </div>
        </section>

        <div className="panel-right-column">
          <section className="panel panel-preview">
            <div className="panel-header">
              <div>
                <span className="panel-kicker">2. Preview</span>
                <h2>Visual placement</h2>
              </div>
            </div>

            <CertificatePreview
              templateFile={templateFile}
              sampleName={sampleName}
              sampleCertificateId={formatCertificateId(
                certificateIdPrefix,
                certificateIdStart
              )}
              namePosition={position}
              certificateIdPosition={certificateIdPosition}
              qrPosition={qrPosition}
              nameFontSize={fontSize}
              nameFontKey={fontKey}
              nameTextColor={textColor}
              certificateIdFontSize={certificateIdFontSize}
              certificateIdFontKey={certificateIdFontKey}
              certificateIdTextColor={certificateIdTextColor}
              qrSize={qrSize}
              activePlacement={activePlacement}
              onActivePlacementChange={setActivePlacement}
              onNamePositionChange={setPosition}
              onCertificateIdPositionChange={setCertificateIdPosition}
              onQrPositionChange={setQrPosition}
              onTemplateMetricsChange={setTemplateMetrics}
            />
          </section>

          <section className="panel panel-generate">
            <div className="panel-header">
              <div>
                <span className="panel-kicker">3. Generate & Download</span>
                <h2>Certificates</h2>
              </div>
            </div>

            <div className="button-row">
              <button
                type="button"
                className="button primary"
                onClick={handleGenerate}
                disabled={!canGenerate}
              >
                {isSubmitting ? "Starting generation..." : "Generate Certificates"}
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={handleDownload}
                disabled={!canDownload}
              >
                Download ZIP
              </button>
            </div>

            {error ? <div className="notice error">{error}</div> : null}

            <div className="status-card">
              <div className="status-head">
                <div>
                  <span className="panel-kicker">Progress</span>
                  <h3>{formatStatus(batchStatus?.status, isSubmitting)}</h3>
                </div>
                <span className="progress-number">{progressValue}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progressValue}%` }} />
              </div>
              <div className="status-meta">
                <span>
                  {batchStatus?.processedCount ?? 0} / {batchStatus?.totalCount ?? 0} PDFs
                  generated
                </span>
                <span>{csvFile ? csvFile.name : "Upload a CSV to begin"}</span>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

function formatStatus(status, isSubmitting) {
  if (isSubmitting) {
    return "Uploading files";
  }

  switch (status) {
    case "queued":
      return "Batch queued";
    case "parsing":
      return "Parsing CSV";
    case "processing":
      return "Generating certificates";
    case "zipping":
      return "Creating ZIP archive";
    case "completed":
      return "Ready to download";
    case "failed":
      return "Generation failed";
    default:
      return "Waiting to start";
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatCertificateId(prefix, startValue) {
  const cleanPrefix = String(prefix ?? "").trim();
  const cleanNumber = Number.isFinite(startValue) ? Math.max(0, startValue) : 0;

  if (!cleanPrefix) {
    return String(cleanNumber);
  }

  return `${cleanPrefix}-${cleanNumber}`;
}

