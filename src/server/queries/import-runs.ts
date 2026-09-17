import type { ImportModule } from "@prisma/client";

import { db } from "@/lib/db";
import { assertCan, type SessionUser } from "@/server/rbac";

// Import History (§7): a simple audit trail of who uploaded what and when,
// reusing the existing "view internal activity" permission rather than a
// new RBAC resource — consistent with how the rest of the audit trail is
// gated.
export async function listImportRuns(
  user: SessionUser,
  params: { page?: number; module?: ImportModule | "ALL" },
) {
  assertCan(user, "view", "auditLog");
  const page = params.page ?? 1;
  const pageSize = 25;

  const where = params.module && params.module !== "ALL" ? { module: params.module } : {};

  const [runs, total] = await Promise.all([
    db.importRun.findMany({
      where,
      include: { uploadedBy: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.importRun.count({ where }),
  ]);

  return { runs, total, page, pageSize };
}

export async function getImportRun(user: SessionUser, id: string) {
  assertCan(user, "view", "auditLog");
  return db.importRun.findUnique({
    where: { id },
    include: { uploadedBy: { select: { name: true, email: true } } },
  });
}
