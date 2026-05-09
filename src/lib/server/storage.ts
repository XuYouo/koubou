import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function storageRoot() {
  return path.resolve(process.env.APP_STORAGE_DIR || "./data/storage");
}

export function extensionFromMime(mime: string) {
  return MIME_EXTENSIONS[mime] || "bin";
}

export async function writeAssetFile({
  userId,
  projectId,
  mime,
  bytes,
}: {
  userId: string;
  projectId: string;
  mime: string;
  bytes: Uint8Array;
}) {
  const extension = extensionFromMime(mime);
  const relativePath = path.join(
    userId,
    projectId,
    `${crypto.randomUUID()}.${extension}`
  );
  const absolutePath = path.join(storageRoot(), relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, bytes);
  return relativePath;
}

export function assetAbsolutePath(storagePath: string) {
  const root = storageRoot();
  const absolutePath = path.resolve(root, storagePath);
  if (!absolutePath.startsWith(root)) {
    throw new Error("Invalid asset path");
  }
  return absolutePath;
}

export async function readAssetBytes(storagePath: string) {
  return fs.readFile(assetAbsolutePath(storagePath));
}
