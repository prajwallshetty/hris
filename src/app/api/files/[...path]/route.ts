import { readFile, stat } from "node:fs/promises";

import { resolveUploadPath } from "@/lib/storage";
import { getWorker } from "@/server/queries/workers";
import { getSessionUser } from "@/server/session";

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

// /api is outside proxy.ts's auth matcher, so this handler enforces its
// own auth/RBAC — same note as /api/workers/export. A document under
// workers/<id>/... is only served back if the caller can currently view
// that specific worker (getWorker applies the same role scoping as the
// worker detail page), not just "is logged in".
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  let user;
  try {
    user = await getSessionUser();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const { path: segments } = await params;
  if (segments[0] === "workers" && segments[1]) {
    const worker = await getWorker(user, segments[1]).catch(() => null);
    if (!worker) return new Response("Not found", { status: 404 });
  } else {
    return new Response("Not found", { status: 404 });
  }

  const absolutePath = resolveUploadPath(segments);
  if (!absolutePath) return new Response("Not found", { status: 404 });

  try {
    await stat(absolutePath);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const buffer = await readFile(absolutePath);
  const extension = segments[segments.length - 1].split(".").pop()?.toLowerCase() ?? "";
  const contentType = CONTENT_TYPES[extension] ?? "application/octet-stream";

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${segments[segments.length - 1]}"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
