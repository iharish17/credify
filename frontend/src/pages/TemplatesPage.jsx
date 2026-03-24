import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatBytes } from "../utils/fileHelpers";

const TIPS = [
  "Keep your Name placement area away from dense decorative graphics.",
  "Reserve space at the bottom-right for QR when targeting mobile scanning.",
  "Use darker text colors over light backgrounds for PDF print consistency.",
];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState("");
  const [pendingDeleteTemplate, setPendingDeleteTemplate] = useState(null);
  const [error, setError] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateCategory, setTemplateCategory] = useState("General");
  const [templateFile, setTemplateFile] = useState(null);

  useEffect(() => {
    void loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setError("");
      const response = await fetch("/api/templates");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load templates.");
      }

      setTemplates(Array.isArray(data.templates) ? data.templates : []);
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async (event) => {
    event.preventDefault();

    if (!templateFile) {
      setError("Choose a PDF, PNG, or JPG template to upload.");
      return;
    }

    setIsUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("template", templateFile);
      formData.append("name", templateName || templateFile.name);
      formData.append("category", templateCategory || "General");

      const response = await fetch("/api/templates", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Template upload failed.");
      }

      setTemplateFile(null);
      setTemplateName("");
      await loadTemplates();
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setIsUploading(false);
    }
  };

  const openDeletePopup = (template) => {
    setPendingDeleteTemplate(template);
  };

  const closeDeletePopup = () => {
    if (deletingTemplateId) {
      return;
    }

    setPendingDeleteTemplate(null);
  };

  const confirmDeleteTemplate = async () => {
    if (!pendingDeleteTemplate) {
      return;
    }

    const template = pendingDeleteTemplate;

    setDeletingTemplateId(template.id);
    setError("");

    try {
      const response = await fetch(`/api/templates/${template.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Unable to delete template.");
      }

      setTemplates((current) => current.filter((item) => item.id !== template.id));
      setPendingDeleteTemplate(null);
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setDeletingTemplateId("");
    }
  };

  return (
    <section className="page-stack">
      <header className="page-header-card">
        <span className="eyebrow">Template Center</span>
        <h1>Upload and manage reusable certificate templates.</h1>
        <p>
          Keep all your frequently used designs in one gallery and send any
          selected template to the generator in one click.
        </p>
      </header>

      <section className="panel template-upload-panel">
        <div className="panel-header compact">
          <div>
            <span className="panel-kicker">Upload Template</span>
            <h2>Add to library</h2>
          </div>
        </div>

        <form className="template-upload-form" onSubmit={handleUpload}>
          <label className="field">
            <span>Template name</span>
            <input
              type="text"
              value={templateName}
              maxLength={80}
              placeholder="e.g. Graduation 2026"
              onChange={(event) => setTemplateName(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Category</span>
            <input
              type="text"
              value={templateCategory}
              maxLength={40}
              onChange={(event) => setTemplateCategory(event.target.value)}
            />
          </label>

          <label className="field template-file-input">
            <span>Template file</span>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(event) => setTemplateFile(event.target.files?.[0] || null)}
            />
          </label>

          <button className="button primary" type="submit" disabled={isUploading}>
            {isUploading ? "Uploading..." : "Upload Template"}
          </button>
        </form>

        {templateFile ? (
          <p className="helper-copy">Selected file: {templateFile.name}</p>
        ) : null}

        {error ? <div className="notice error">{error}</div> : null}
      </section>

      <section className="template-grid">
        {isLoading ? (
          <article className="panel">
            <h3>Loading template library...</h3>
          </article>
        ) : templates.length === 0 ? (
          <article className="panel">
            <h3>Your template library is empty</h3>
            <p className="helper-copy">
              Upload your first template above, then use it directly in the generator.
            </p>
          </article>
        ) : (
          templates.map((template) => (
            <article className="template-card" key={template.id}>
              <div className="template-swatch template-swatch-live">
                {template.mimeType.startsWith("image/") ? (
                  <img
                    alt={`${template.name} preview`}
                    className="template-thumb"
                    src={template.previewUrl || template.downloadUrl}
                  />
                ) : (
                  <div className="template-doc-pill">PDF Template</div>
                )}
              </div>
              <div className="template-card-body">
                <span className="template-category">{template.category}</span>
                <h3>{template.name}</h3>
                <p>
                  {template.originalName} · {formatBytes(template.size)}
                </p>
              </div>
              <div className="template-actions">
                <Link className="button secondary" to={`/?templateId=${template.id}`}>
                  Use In Generator
                </Link>
                <a className="button ghost" href={template.downloadUrl}>
                  Download
                </a>
                <button
                  className="button danger"
                  type="button"
                  disabled={deletingTemplateId === template.id}
                  onClick={() => openDeletePopup(template)}
                >
                  {deletingTemplateId === template.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      {pendingDeleteTemplate ? (
        <div className="modal-backdrop" role="presentation" onClick={closeDeletePopup}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-template-title"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="panel-kicker">Delete Template</span>
            <h3 id="delete-template-title">Remove from template library?</h3>
            <p>
              This will permanently delete <strong>{pendingDeleteTemplate.name}</strong>
              {" "}from your saved templates.
            </p>

            <div className="modal-actions">
              <button
                type="button"
                className="button ghost"
                onClick={closeDeletePopup}
                disabled={Boolean(deletingTemplateId)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button danger"
                onClick={confirmDeleteTemplate}
                disabled={Boolean(deletingTemplateId)}
              >
                {deletingTemplateId ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="template-tips">
        <h2>Placement tips before upload</h2>
        <div className="tips-grid">
          {TIPS.map((tip) => (
            <p className="tip-item" key={tip}>
              {tip}
            </p>
          ))}
        </div>
      </section>
    </section>
  );
}
