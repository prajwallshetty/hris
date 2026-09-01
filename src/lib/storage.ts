import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Local-disk document storage. This app has no cloud blob provider
// configured (BLOB_READ_WRITE_TOKEN is an empty placeholder in
// .env.example), so files are written under a project-root `storage/`
// directory instead of `public/` — kept out of the static file tree so
// every read goes through the authenticated route handler in
// src/app/api/files/[...path]/route.ts rather than being world-readable.
// This works for a single-instance, persistent-disk deployment (the
// docker-compose setup this app already ships with); it will NOT persist
// across redeploys or multiple instances on serverless platforms like
// Vercel — swapping in a real blob provider means changing only this
// file and the route handler that serves it back.
const UPLOAD_ROOT = path.join(process.cwd(), "storage", "uploads");

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
}

export type StoredFile = {
  storedName: string;
  url: string;
};

/**
 * Saves an uploaded file under `storage/uploads/<subdir>/`, returning a
 * URL served by the protected `/api/files/<subdir>/<storedName>` route.
 */
export async function saveUploadedFile(file: File, subdir: string): Promise<StoredFile> {
  const dir = path.join(UPLOAD_ROOT, subdir);
  await mkdir(dir, { recursive: true });

  const storedName = `${randomUUID()}-${sanitizeFileName(file.name || "file")}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, storedName), buffer);

  return { storedName, url: `/api/files/${subdir}/${storedName}` };
}

/** Resolves a `subdir`/`storedName` pair to an absolute path, rejecting any attempt to escape the upload root. */
export function resolveUploadPath(segments: string[]): string | null {
  const resolved = path.join(UPLOAD_ROOT, ...segments);
  if (!resolved.startsWith(UPLOAD_ROOT + path.sep)) return null; // path traversal guard
  return resolved;
}
