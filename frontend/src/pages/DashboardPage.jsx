import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const STATUS_CLASS_MAP = {
  queued: "status-chip queued",
  parsing: "status-chip processing",
  processing: "status-chip processing",
  zipping: "status-chip processing",
  completed: "status-chip completed",
  failed: "status-chip failed",
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [visibleParticipantsByBatchId, setVisibleParticipantsByBatchId] =
    useState({});
  const [participantsByBatchId, setParticipantsByBatchId] = useState({});
  const [participantLoadingByBatchId, setParticipantLoadingByBatchId] =
    useState({});
  const [participantErrorByBatchId, setParticipantErrorByBatchId] = useState({});
  const [activeCertificatePreview, setActiveCertificatePreview] = useState(null);
  const [pendingDeleteBatch, setPendingDeleteBatch] = useState(null);
  const [deletingBatchId, setDeletingBatchId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const interval = window.setInterval(fetchBatches, 5000);

    void fetchBatches();

    async function fetchBatches() {
      try {
        if (!cancelled) {
          setError("");
        }

        const response = await fetch("/api/batches?limit=12");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load dashboard batches.");
        }

        if (!cancelled) {
          setBatches(Array.isArray(data.batches) ? data.batches : []);
          setIsLoading(false);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError.message);
          setIsLoading(false);
        }
      }
    }

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const handleToggleParticipants = async (batchId) => {
    const isVisible = Boolean(visibleParticipantsByBatchId[batchId]);

    if (isVisible) {
      setVisibleParticipantsByBatchId((current) => ({
        ...current,
        [batchId]: false,
      }));
      return;
    }

    setVisibleParticipantsByBatchId((current) => ({
      ...current,
      [batchId]: true,
    }));

    if (participantsByBatchId[batchId]) {
      return;
    }

    setParticipantLoadingByBatchId((current) => ({
      ...current,
      [batchId]: true,
    }));
    setParticipantErrorByBatchId((current) => ({
      ...current,
      [batchId]: "",
    }));

    try {
      const response = await fetch(`/api/batches/${batchId}/participants`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load participant list.");
      }

      setParticipantsByBatchId((current) => ({
        ...current,
        [batchId]: Array.isArray(data.participants) ? data.participants : [],
      }));
    } catch (fetchError) {
      setParticipantErrorByBatchId((current) => ({
        ...current,
        [batchId]: fetchError.message,
      }));
    } finally {
      setParticipantLoadingByBatchId((current) => ({
        ...current,
        [batchId]: false,
      }));
    }
  };

  const closeCertificatePreview = () => {
    setActiveCertificatePreview(null);
  };

  const openDeletePopup = (batch) => {
    setPendingDeleteBatch(batch);
  };

  const closeDeletePopup = () => {
    if (deletingBatchId) {
      return;
    }

    setPendingDeleteBatch(null);
  };

  const handleReeditPlacement = () => {
    if (!activeCertificatePreview?.batchId) {
      return;
    }

    navigate(`/?batchId=${activeCertificatePreview.batchId}`);
  };

  const confirmDeleteBatch = async () => {
    if (!pendingDeleteBatch) {
      return;
    }

    const batch = pendingDeleteBatch;

    setDeletingBatchId(batch.id);

    try {
      const response = await fetch(`/api/batches/${batch.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Unable to delete batch.");
      }

      setBatches((current) => current.filter((item) => item.id !== batch.id));
      setParticipantsByBatchId((current) => {
        const next = { ...current };
        delete next[batch.id];
        return next;
      });
      setVisibleParticipantsByBatchId((current) => {
        const next = { ...current };
        delete next[batch.id];
        return next;
      });
      if (activeCertificatePreview?.batchId === batch.id) {
        setActiveCertificatePreview(null);
      }
      setPendingDeleteBatch(null);
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setDeletingBatchId("");
    }
  };

  return (
    <section className="page-stack">
      <header className="page-header-card">
        <span className="eyebrow">Dashboard</span>
        <h1>Track recent generated certificates.</h1>
        <p>
          This page refreshes automatically and shows status, progress, and
          generated participant counts for your latest batches.
        </p>
      </header>

      {error ? <div className="notice error">{error}</div> : null}

      <section className="dashboard-grid">
        {isLoading ? (
          <article className="panel">
            <h2>Loading recent batches...</h2>
          </article>
        ) : batches.length === 0 ? (
          <article className="panel">
            <h2>No batches yet</h2>
            <p className="helper-copy">
              Start your first generation run from the Generator page and it will
              appear here.
            </p>
          </article>
        ) : (
          batches.map((batch) => (
            <article className="batch-card" key={batch.id}>
              <div className="batch-card-head">
                <h3>{batch.templateName || "Certificate run"}</h3>
                <span className={STATUS_CLASS_MAP[batch.status] || "status-chip"}>
                  {batch.status}
                </span>
              </div>

              <p className="batch-id">Batch ID: {batch.id}</p>

              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${batch.progress || 0}%` }} />
              </div>

              <div className="batch-meta-grid">
                <span>{batch.progress || 0}% complete</span>
                <span>
                  {batch.processedCount || 0} / {batch.totalCount || 0} generated
                </span>
                <span>{formatDate(batch.updatedAt || batch.createdAt)}</span>
              </div>

              {batch.status === "completed" && batch.downloadUrl ? (
                <a className="button secondary" href={batch.downloadUrl}>
                  Download ZIP
                </a>
              ) : null}

              <button
                type="button"
                className="button ghost"
                onClick={() => handleToggleParticipants(batch.id)}
              >
                {visibleParticipantsByBatchId[batch.id]
                  ? "Hide Participants"
                  : "Show Participants"}
              </button>

              <button
                type="button"
                className="button danger"
                disabled={deletingBatchId === batch.id}
                onClick={() => openDeletePopup(batch)}
              >
                {deletingBatchId === batch.id ? "Deleting Batch..." : "Delete Batch"}
              </button>

              {visibleParticipantsByBatchId[batch.id] ? (
                <div className="participants-panel">
                  {participantLoadingByBatchId[batch.id] ? (
                    <p className="helper-copy">Loading participants...</p>
                  ) : participantErrorByBatchId[batch.id] ? (
                    <p className="batch-error">{participantErrorByBatchId[batch.id]}</p>
                  ) : (participantsByBatchId[batch.id] || []).length === 0 ? (
                    <p className="helper-copy">
                      Participant certificates are not available yet for this batch.
                    </p>
                  ) : (
                    <ul className="participant-list">
                      {(participantsByBatchId[batch.id] || []).map((participant) => (
                        <li className="participant-item" key={participant.fileName}>
                          <div className="participant-main">
                            <strong>{participant.participantName}</strong>
                            <span>{participant.certificateId}</span>
                          </div>
                          <div className="participant-actions">
                            <button
                              type="button"
                              className="button secondary"
                              onClick={() =>
                                setActiveCertificatePreview({
                                  batchId: batch.id,
                                  participant,
                                })
                              }
                            >
                              View Certificate
                            </button>
                            <a className="button ghost" href={participant.downloadUrl}>
                              Download
                            </a>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}

              {batch.status === "failed" && batch.error ? (
                <p className="batch-error">{batch.error}</p>
              ) : null}
            </article>
          ))
        )}
      </section>

      {activeCertificatePreview ? (
        <div
          className="modal-backdrop certificate-modal-backdrop"
          role="presentation"
          onClick={closeCertificatePreview}
        >
          <div
            className="modal-card certificate-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="certificate-preview-title"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="panel-kicker">Participant Certificate</span>
            <h3 id="certificate-preview-title">
              {activeCertificatePreview.participant.participantName}
            </h3>
            <p>{activeCertificatePreview.participant.certificateId}</p>

            <div className="certificate-preview-frame-wrap">
              <iframe
                className="certificate-preview-frame"
                src={
                  activeCertificatePreview.participant.previewUrl ||
                  activeCertificatePreview.participant.downloadUrl
                }
                title="Participant Certificate Preview"
              />
            </div>

            <div className="modal-actions">
              <button type="button" className="button ghost" onClick={closeCertificatePreview}>
                Close
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={handleReeditPlacement}
              >
                Re-edit Placement
              </button>
              <a className="button primary" href={activeCertificatePreview.participant.downloadUrl}>
                Download Certificate
              </a>
            </div>
          </div>
        </div>
      ) : null}

      {pendingDeleteBatch ? (
        <div className="modal-backdrop" role="presentation" onClick={closeDeletePopup}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-batch-title"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="panel-kicker">Delete Batch</span>
            <h3 id="delete-batch-title">Delete this batch of certificates?</h3>
            <p>
              This will permanently delete <strong>{pendingDeleteBatch.templateName || pendingDeleteBatch.id}</strong>
              {" "}and all {pendingDeleteBatch.participantCertificateCount || 0} generated certificates.
            </p>

            <div className="modal-actions">
              <button
                type="button"
                className="button ghost"
                onClick={closeDeletePopup}
                disabled={Boolean(deletingBatchId)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button danger"
                onClick={confirmDeleteBatch}
                disabled={Boolean(deletingBatchId)}
              >
                {deletingBatchId ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function formatDate(timestamp) {
  if (!timestamp) {
    return "-";
  }

  const date = new Date(timestamp);
  return Number.isNaN(date.valueOf()) ? "-" : date.toLocaleString();
}

