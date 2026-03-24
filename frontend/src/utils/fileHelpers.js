export function formatBytes(bytes) {
  const value = Number(bytes);

  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1
  );
  const adjusted = value / Math.pow(1024, unitIndex);

  return `${adjusted.toFixed(adjusted >= 10 || unitIndex === 0 ? 0 : 1)} ${
    units[unitIndex]
  }`;
}
