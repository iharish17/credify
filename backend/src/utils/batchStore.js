export function createBatchStore({ ttlMs, cleanupIntervalMs, onExpire }) {
  const batches = new Map();

  const interval = setInterval(async () => {
    const now = Date.now();
    const expiredBatches = [...batches.values()].filter(
      (batch) =>
        now - (batch.completedAt ?? batch.failedAt ?? batch.createdAt) > ttlMs &&
        (batch.status === "completed" || batch.status === "failed")
    );

    await Promise.all(
      expiredBatches.map(async (batch) => {
        batches.delete(batch.id);
        await onExpire?.(batch);
      })
    );
  }, cleanupIntervalMs);

  interval.unref?.();

  return {
    create(batch) {
      batches.set(batch.id, {
        ...batch,
        progress: 0,
        processedCount: 0,
        totalCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return batches.get(batch.id);
    },

    get(batchId) {
      return batches.get(batchId);
    },

    remove(batchId) {
      const existing = batches.get(batchId);
      if (!existing) {
        return null;
      }

      batches.delete(batchId);
      return existing;
    },

    listRecent(limit = 20) {
      return [...batches.values()]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, Math.max(1, limit));
    },

    update(batchId, patch) {
      const existing = batches.get(batchId);
      if (!existing) {
        return null;
      }

      const updated = {
        ...existing,
        ...patch,
        updatedAt: Date.now(),
      };

      batches.set(batchId, updated);
      return updated;
    },

    incrementProcessed(batchId) {
      const existing = batches.get(batchId);
      if (!existing) {
        return null;
      }

      const processedCount = existing.processedCount + 1;
      const processingWeight = existing.totalCount
        ? (processedCount / existing.totalCount) * 88
        : 0;

      const updated = {
        ...existing,
        processedCount,
        progress: Math.min(95, Math.round(7 + processingWeight)),
        updatedAt: Date.now(),
      };

      batches.set(batchId, updated);
      return updated;
    },

    fail(batchId, errorMessage) {
      const existing = batches.get(batchId);
      if (!existing) {
        return null;
      }

      const updated = {
        ...existing,
        status: "failed",
        error: errorMessage,
        failedAt: Date.now(),
        updatedAt: Date.now(),
      };

      batches.set(batchId, updated);
      return updated;
    },

    complete(batchId, patch = {}) {
      const existing = batches.get(batchId);
      if (!existing) {
        return null;
      }

      const updated = {
        ...existing,
        ...patch,
        status: "completed",
        progress: 100,
        completedAt: Date.now(),
        updatedAt: Date.now(),
      };

      batches.set(batchId, updated);
      return updated;
    },

    dispose() {
      clearInterval(interval);
    },
  };
}


