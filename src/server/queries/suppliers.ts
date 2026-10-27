import type { EntityStatus, Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { assertCan, type SessionUser } from "@/server/rbac";

export async function listSuppliers(
  user: SessionUser,
  params: { search?: string; status?: EntityStatus | "ALL"; page?: number; pageSize?: number } = {},
) {
  assertCan(user, "view", "supplier");
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;
  const search = params.search?.trim();

  const where: Prisma.SupplierWhereInput = {
    ...(params.status && params.status !== "ALL" ? { status: params.status } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { contactPerson: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
          ],
        }
      : {}),
  };

  const [suppliers, total] = await Promise.all([
    db.supplier.findMany({
      where,
      include: { _count: { select: { workers: { where: { deletedAt: null } } } } },
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.supplier.count({ where }),
  ]);

  return { suppliers, total, page, pageSize };
}

/** Active suppliers for selectors (registration form, edit form, filters). */
export async function listSuppliersForSelect() {
  return db.supplier.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } });
}
