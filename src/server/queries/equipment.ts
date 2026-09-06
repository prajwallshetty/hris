import type { EquipmentStatus, Prisma, RentalStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { parseEquipmentCodeSearch, parseRentalCodeSearch } from "@/lib/validation/equipment";
import { assertCan, equipmentRentalScopeWhere, equipmentScopeWhere, type SessionUser } from "@/server/rbac";

function buildEquipmentSearchWhere(search?: string): Prisma.EquipmentWhereInput {
  if (!search) return {};
  const codeMatch = parseEquipmentCodeSearch(search);
  return {
    OR: [
      { serialNumber: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
      { category: { contains: search, mode: "insensitive" } },
      ...(codeMatch !== null ? [{ sequenceNo: codeMatch }] : []),
    ],
  };
}

const CURRENT_RENTAL_INCLUDE = {
  rentals: {
    where: { status: { in: ["ACTIVE" as const, "EXTENDED" as const] } },
    orderBy: { startDate: "desc" as const },
    take: 1,
    include: { client: true, site: true },
  },
  coordinator: true,
};

export async function listEquipment(
  user: SessionUser,
  params: { search?: string; status?: EquipmentStatus | "ALL"; page?: number; pageSize?: number },
) {
  assertCan(user, "view", "equipment");
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;

  const where: Prisma.EquipmentWhereInput = {
    deletedAt: null,
    ...equipmentScopeWhere(user),
    ...(params.status && params.status !== "ALL" ? { status: params.status } : {}),
    ...buildEquipmentSearchWhere(params.search),
  };

  const [equipment, total] = await Promise.all([
    db.equipment.findMany({
      where,
      include: CURRENT_RENTAL_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.equipment.count({ where }),
  ]);

  return { equipment, total, page, pageSize };
}

export async function getEquipment(user: SessionUser, id: string) {
  assertCan(user, "view", "equipment");
  return db.equipment.findFirst({
    where: { id, deletedAt: null, ...equipmentScopeWhere(user) },
    include: {
      coordinator: true,
      rentals: {
        orderBy: { startDate: "desc" },
        include: { client: true, project: true, site: true, coordinator: true, charges: true, payments: true },
      },
      maintenance: { orderBy: { createdAt: "desc" } },
      documents: { orderBy: { uploadedAt: "desc" } },
    },
  });
}

export async function listEquipmentForSelect(user: SessionUser, params?: { onlyAvailable?: boolean }) {
  assertCan(user, "view", "equipment");
  return db.equipment.findMany({
    where: {
      deletedAt: null,
      ...equipmentScopeWhere(user),
      ...(params?.onlyAvailable ? { status: "AVAILABLE" } : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      serialNumber: true,
      status: true,
      sequenceNo: true,
      hourlyRate: true,
      dailyRate: true,
      weeklyRate: true,
      monthlyRate: true,
    },
  });
}

function buildRentalSearchWhere(search?: string): Prisma.EquipmentRentalWhereInput {
  if (!search) return {};
  const codeMatch = parseRentalCodeSearch(search);
  return {
    OR: [
      { equipment: { name: { contains: search, mode: "insensitive" } } },
      { equipment: { serialNumber: { contains: search, mode: "insensitive" } } },
      { client: { companyName: { contains: search, mode: "insensitive" } } },
      ...(codeMatch !== null ? [{ sequenceNo: codeMatch }] : []),
    ],
  };
}

export async function listRentals(
  user: SessionUser,
  params: { search?: string; status?: RentalStatus | "ALL"; page?: number; pageSize?: number },
) {
  assertCan(user, "view", "equipmentRental");
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;

  const where: Prisma.EquipmentRentalWhereInput = {
    ...equipmentRentalScopeWhere(user),
    ...(params.status && params.status !== "ALL" ? { status: params.status } : {}),
    ...buildRentalSearchWhere(params.search),
  };

  const [rentals, total] = await Promise.all([
    db.equipmentRental.findMany({
      where,
      include: { equipment: true, client: true, site: true, charges: true, payments: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.equipmentRental.count({ where }),
  ]);

  return { rentals, total, page, pageSize };
}

export async function getRental(user: SessionUser, id: string) {
  assertCan(user, "view", "equipmentRental");
  return db.equipmentRental.findFirst({
    where: { id, ...equipmentRentalScopeWhere(user) },
    include: {
      equipment: true,
      client: true,
      project: true,
      site: true,
      coordinator: true,
      charges: { orderBy: { date: "desc" } },
      payments: { orderBy: { date: "desc" } },
    },
  });
}

export async function listRentalsForEquipment(equipmentId: string) {
  return db.equipmentRental.findMany({
    where: { equipmentId },
    orderBy: { startDate: "desc" },
    include: { client: true, site: true, charges: true, payments: true },
  });
}

export async function listEquipmentForCoordinator(coordinatorId: string) {
  return db.equipment.findMany({
    where: { coordinatorId, deletedAt: null },
    orderBy: { name: "asc" },
    include: CURRENT_RENTAL_INCLUDE,
  });
}

export async function listRentalsForClient(clientId: string) {
  return db.equipmentRental.findMany({
    where: { clientId },
    orderBy: { startDate: "desc" },
    include: { equipment: true, site: true, charges: true, payments: true },
  });
}

export async function listUpcomingEquipmentMaintenance(daysAhead = 30) {
  const now = new Date();
  const horizon = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  return db.equipmentMaintenance.findMany({
    where: { status: { in: ["SCHEDULED", "IN_PROGRESS"] }, nextServiceDate: { gte: now, lte: horizon } },
    include: { equipment: true },
    orderBy: { nextServiceDate: "asc" },
  });
}

export async function listUpcomingEquipmentDocumentExpiries(daysAhead = 30) {
  const now = new Date();
  const horizon = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  return db.equipmentDocument.findMany({
    where: { expiryDate: { gte: now, lte: horizon } },
    include: { equipment: true },
    orderBy: { expiryDate: "asc" },
  });
}

// Sum of every charge across a client's rentals — the cost side of the
// profitability formula (§4/§20). Never cached, always derived on read,
// same discipline as getVehicleExpenseTotal.
export async function getEquipmentRentalCostForClient(clientId: string) {
  const result = await db.rentalCharge.aggregate({
    where: { rental: { clientId } },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

export async function listOverdueRentals() {
  const now = new Date();
  return db.equipmentRental.findMany({
    where: { status: { in: ["ACTIVE", "EXTENDED"] }, expectedEndDate: { lt: now } },
    include: { equipment: true, client: true },
    orderBy: { expectedEndDate: "asc" },
  });
}
