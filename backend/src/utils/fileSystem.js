import archiver from "archiver";
import fs from "node:fs";
import fsp from "node:fs/promises";

export async function ensureDir(directoryPath) {
  await fsp.mkdir(directoryPath, { recursive: true });
}

export async function removeDir(directoryPath) {
  await fsp.rm(directoryPath, { recursive: true, force: true });
}

export function safeFileName(input) {
  return (
    input
      .normalize("NFKD")
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80)
      .toLowerCase() || "certificate"
  );
}

export async function createZipArchive(sourceDirectory, outputPath) {
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver("zip", {
      zlib: { level: 9 },
    });

    output.on("close", resolve);
    output.on("error", reject);
    archive.on("error", reject);

    archive.pipe(output);
    archive.directory(sourceDirectory, false);
    archive.finalize();
  });
}

