import { useEffect, useMemo, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { getFontOption } from "../fontOptions";

GlobalWorkerOptions.workerSrc = pdfWorker;

export default function CertificatePreview({
  templateFile,
  sampleName,
  sampleCertificateId,
  namePosition,
  certificateIdPosition,
  qrPosition,
  nameFontSize,
  nameFontKey,
  nameTextColor,
  certificateIdFontSize,
  certificateIdFontKey,
  certificateIdTextColor,
  qrSize,
  activePlacement,
  onActivePlacementChange,
  onNamePositionChange,
  onCertificateIdPositionChange,
  onQrPositionChange,
  onTemplateMetricsChange,
}) {
  const canvasRef = useRef(null);
  const surfaceRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewKind, setPreviewKind] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [templateMetrics, setTemplateMetrics] = useState(null);
  const [surfaceBounds, setSurfaceBounds] = useState({
    width: 0,
    height: 0,
  });
  const selectedNameFont = useMemo(() => getFontOption(nameFontKey), [nameFontKey]);
  const selectedCertificateIdFont = useMemo(
    () => getFontOption(certificateIdFontKey),
    [certificateIdFontKey]
  );

  useEffect(() => {
    if (!templateFile) {
      setPreviewUrl("");
      setPreviewKind("");
      setPreviewError("");
      setTemplateMetrics(null);
      onTemplateMetricsChange(null);
      return undefined;
    }

    const url = URL.createObjectURL(templateFile);
    setPreviewUrl(url);
    setPreviewError("");

    if (templateFile.type === "application/pdf") {
      setPreviewKind("pdf");
    } else if (templateFile.type.startsWith("image/")) {
      setPreviewKind("image");
    } else {
      setPreviewKind("");
      setPreviewError("Unsupported template type.");
    }

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [templateFile, onTemplateMetricsChange]);

  useEffect(() => {
    if (!surfaceRef.current) {
      return undefined;
    }

    const observer = new ResizeObserver(([entry]) => {
      setSurfaceBounds({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    observer.observe(surfaceRef.current);
    return () => observer.disconnect();
  }, [templateMetrics?.width, templateMetrics?.height]);

  useEffect(() => {
    if (!previewUrl || previewKind !== "pdf" || !canvasRef.current) {
      return undefined;
    }

    let cancelled = false;
    let loadingTask;
    let renderTask;

    const renderPdfPreview = async () => {
      try {
        setIsLoading(true);
        setPreviewError("");

        loadingTask = getDocument(previewUrl);
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);

        if (cancelled) {
          return;
        }

        const baseViewport = page.getViewport({ scale: 1 });
        const renderScale = Math.max(window.devicePixelRatio || 1, 1.5);
        const renderViewport = page.getViewport({ scale: renderScale });
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");

        setTemplateMetrics({
          width: baseViewport.width,
          height: baseViewport.height,
        });
        onTemplateMetricsChange({
          width: baseViewport.width,
          height: baseViewport.height,
        });

        canvas.width = renderViewport.width;
        canvas.height = renderViewport.height;

        renderTask = page.render({
          canvasContext: context,
          viewport: renderViewport,
        });

        await renderTask.promise;

        if (!cancelled) {
          setIsLoading(false);
        }
      } catch (_error) {
        if (!cancelled) {
          setIsLoading(false);
          setPreviewError("Unable to render the PDF preview.");
        }
      }
    };

    renderPdfPreview();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      loadingTask?.destroy();
    };
  }, [previewUrl, previewKind, onTemplateMetricsChange]);

  const displayScale = useMemo(() => {
    if (!templateMetrics?.width || !surfaceBounds.width) {
      return 1;
    }

    return surfaceBounds.width / templateMetrics.width;
  }, [surfaceBounds.width, templateMetrics?.width]);

  const nameOverlayStyle = useMemo(() => {
    if (!templateMetrics) {
      return {};
    }

    return {
      left: `${namePosition.x * displayScale}px`,
      top: `${namePosition.y * displayScale}px`,
      fontSize: `${nameFontSize * displayScale}px`,
      color: nameTextColor,
      fontFamily: selectedNameFont.cssFamily,
      fontWeight: selectedNameFont.cssWeight,
      fontStyle: selectedNameFont.cssStyle,
      lineHeight: 1,
    };
  }, [
    displayScale,
    nameFontSize,
    namePosition.x,
    namePosition.y,
    nameTextColor,
    selectedNameFont.cssFamily,
    selectedNameFont.cssWeight,
    selectedNameFont.cssStyle,
    templateMetrics,
  ]);

  const certificateIdOverlayStyle = useMemo(() => {
    if (!templateMetrics) {
      return {};
    }

    return {
      left: `${certificateIdPosition.x * displayScale}px`,
      top: `${certificateIdPosition.y * displayScale}px`,
      fontSize: `${certificateIdFontSize * displayScale}px`,
      color: certificateIdTextColor,
      fontFamily: selectedCertificateIdFont.cssFamily,
      fontWeight: selectedCertificateIdFont.cssWeight,
      fontStyle: selectedCertificateIdFont.cssStyle,
      lineHeight: 1,
    };
  }, [
    certificateIdFontSize,
    certificateIdPosition.x,
    certificateIdPosition.y,
    certificateIdTextColor,
    displayScale,
    selectedCertificateIdFont.cssFamily,
    selectedCertificateIdFont.cssWeight,
    selectedCertificateIdFont.cssStyle,
    templateMetrics,
  ]);

  const qrOverlayStyle = useMemo(() => {
    if (!templateMetrics) {
      return {};
    }

    return {
      left: `${qrPosition.x * displayScale}px`,
      top: `${qrPosition.y * displayScale}px`,
      width: `${qrSize * displayScale}px`,
      height: `${qrSize * displayScale}px`,
    };
  }, [displayScale, qrPosition.x, qrPosition.y, qrSize, templateMetrics]);

  const updatePositionByTarget = useMemo(
    () => ({
      name: onNamePositionChange,
      certificateId: onCertificateIdPositionChange,
      qr: onQrPositionChange,
    }),
    [onCertificateIdPositionChange, onNamePositionChange, onQrPositionChange]
  );

  const currentPosition =
    activePlacement === "certificateId"
      ? certificateIdPosition
      : activePlacement === "qr"
      ? qrPosition
      : namePosition;

  const updateTargetPosition =
    updatePositionByTarget[activePlacement] ?? onNamePositionChange;

  const updatePositionFromClientPoint = (clientX, clientY, dragOffset) => {
    if (!surfaceRef.current || !templateMetrics) {
      return;
    }

    const rect = surfaceRef.current.getBoundingClientRect();
    const offsetX = dragOffset?.x ?? 0;
    const offsetY = dragOffset?.y ?? 0;
    const nextX =
      ((clientX - rect.left) / rect.width) * templateMetrics.width - offsetX;
    const nextY =
      ((clientY - rect.top) / rect.height) * templateMetrics.height - offsetY;

    updateTargetPosition({
      x: clamp(Number(nextX.toFixed(2)), 0, templateMetrics.width),
      y: clamp(Number(nextY.toFixed(2)), 0, templateMetrics.height),
    });
  };

  const beginDrag = (event, target) => {
    if (!surfaceRef.current || !templateMetrics) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const targetPosition =
      target === "certificateId"
        ? certificateIdPosition
        : target === "qr"
        ? qrPosition
        : namePosition;
    const moveTargetHandler = updatePositionByTarget[target] ?? onNamePositionChange;
    const rect = surfaceRef.current.getBoundingClientRect();
    const offset = {
      x:
        ((event.clientX - rect.left) / rect.width) * templateMetrics.width -
        targetPosition.x,
      y:
        ((event.clientY - rect.top) / rect.height) * templateMetrics.height -
        targetPosition.y,
    };

    const handleMove = (moveEvent) => {
      if (!surfaceRef.current) {
        return;
      }

      const moveRect = surfaceRef.current.getBoundingClientRect();
      const nextX =
        ((moveEvent.clientX - moveRect.left) / moveRect.width) *
          templateMetrics.width -
        offset.x;
      const nextY =
        ((moveEvent.clientY - moveRect.top) / moveRect.height) *
          templateMetrics.height -
        offset.y;

      moveTargetHandler({
        x: clamp(Number(nextX.toFixed(2)), 0, templateMetrics.width),
        y: clamp(Number(nextY.toFixed(2)), 0, templateMetrics.height),
      });
    };

    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  const handleImageLoad = (event) => {
    const metrics = {
      width: event.currentTarget.naturalWidth,
      height: event.currentTarget.naturalHeight,
    };

    setTemplateMetrics(metrics);
    onTemplateMetricsChange(metrics);
    setIsLoading(false);
  };

  useEffect(() => {
    if (previewKind === "image") {
      setIsLoading(true);
    }
  }, [previewKind]);

  if (!templateFile) {
    return (
      <div className="preview-empty">
        Upload a PDF, PNG, or JPG certificate template to see a live preview.
      </div>
    );
  }

  return (
    <div className="preview-stack">
      <div className="preview-toolbar">
        <span className="pill">
          {templateMetrics
            ? `${Math.round(templateMetrics.width)} x ${Math.round(
                templateMetrics.height
              )}`
            : "Waiting for preview"}
        </span>
        <span className="preview-note">
          Select Name, Certificate ID, or QR and place it with click or drag.
        </span>
      </div>

      <div
        className="preview-surface"
        ref={surfaceRef}
        style={
          templateMetrics
            ? { aspectRatio: `${templateMetrics.width} / ${templateMetrics.height}` }
            : undefined
        }
        onClick={(event) => {
          updatePositionFromClientPoint(event.clientX, event.clientY);
        }}
      >
        {previewKind === "image" ? (
          <img
            src={previewUrl}
            alt="Certificate template preview"
            className="preview-media"
            onLoad={handleImageLoad}
          />
        ) : (
          <canvas ref={canvasRef} className="preview-media" />
        )}

        {!previewError && templateMetrics ? (
          <>
            <button
              type="button"
              className="preview-overlay"
              style={nameOverlayStyle}
              onClick={(event) => {
                event.stopPropagation();
                onActivePlacementChange("name");
              }}
              onPointerDown={(event) => beginDrag(event, "name")}
            >
              {sampleName || "{{Participant Name}}"}
            </button>

            <button
              type="button"
              className="preview-overlay preview-overlay-secondary"
              style={certificateIdOverlayStyle}
              onClick={(event) => {
                event.stopPropagation();
                onActivePlacementChange("certificateId");
              }}
              onPointerDown={(event) => beginDrag(event, "certificateId")}
            >
              {sampleCertificateId || "CERT-0001"}
            </button>

            <button
              type="button"
              className="preview-qr-overlay"
              style={qrOverlayStyle}
              onClick={(event) => {
                event.stopPropagation();
                onActivePlacementChange("qr");
              }}
              onPointerDown={(event) => beginDrag(event, "qr")}
              aria-label="QR placement"
              title="QR placement"
            >
              <span>QR</span>
            </button>
          </>
        ) : null}

        {isLoading ? <div className="preview-badge">Rendering preview...</div> : null}
        {previewError ? <div className="preview-badge error">{previewError}</div> : null}
      </div>
    </div>
  );
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
