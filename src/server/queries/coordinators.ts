import { db } from "@/lib/db";
import { assertCan, coordinatorScopeWhere, type SessionUser } from "@/server/rbac";

export async function listCoordinators(user: SessionUser) {
  assertCan(user, "view", "coordinator");
  return db.coordinator.findMany({
    where: coordinatorScopeWhere(user),
    orderBy: { name: "asc" },
    include: { _count: { select: { workers: true, assignments: { where: { status: "ACTIVE" } } } } },
  });
}

export async function getCoordinatorDetail(user: SessionUser, id: string) {
  assertCan(user, "view", "coordinator");
  return db.coordinator.findFirst({
    where: { id, ...coordinatorScopeWhere(user) },
    include: { _count: { select: { workers: true, assignments: { where: { status: "ACTIVE" } } } } },
  });
}

export async function listCoordinatorSales(coordinatorId: string) {
  return db.sale.findMany({
    where: { coordinatorId },
    include: { client: true, commissions: true },
    orderBy: { date: "desc" },
  });
}

/** Sales with no commission generated yet, for the "generate from sale" picker. */
export async function listUncommissionedSales(coordinatorId: string) {
  return db.sale.findMany({
    where: { coordinatorId, commissions: { none: {} } },
    include: { client: true },
    orderBy: { date: "desc" },
  });
}

export async function listCoordinatorCommissions(coordinatorId: string) {
  return db.commission.findMany({
    where: { coordinatorId },
    include: { commissionRule: true, sale: true, items: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getApplicableCommissionRules(coordinatorId: string) {
  return db.commissionRule.findMany({
    where: { status: "ACTIVE", OR: [{ coordinatorId }, { coordinatorId: null }] },
    orderBy: [{ coordinatorId: "desc" }, { createdAt: "desc" }],
  });
}

export async function listAllCommissionRules() {
  return db.commissionRule.findMany({
    where: { status: "ACTIVE" },
    include: { coordinator: true },
    orderBy: [{ coordinatorId: "asc" }, { createdAt: "desc" }],
  });
}
