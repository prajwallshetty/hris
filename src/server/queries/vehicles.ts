import type { Prisma, VehicleStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { parseVehicleCodeSearch } from "@/lib/validation/vehicle";
import { assertCan, type SessionUser, vehicleScopeWhere } from "@/server/rbac";

function buildVehicleSearchWhere(search?: string): Prisma.VehicleWhereInput {
  if (!search) return {};
  const codeMatch = parseVehicleCodeSearch(search);
  return {
    OR: [
      { plateNumber: { contains: search, mode: "insensitive" } },
      { make: { contains: search, mode: "insensitive" } },
      { model: { contains: search, mode: "insensitive" } },
      { vin: { contains: search, mode: "insensitive" } },
      ...(codeMatch !== null ? [{ sequenceNo: codeMatch }] : []),
    ],
  };
}

const CURRENT_ASSIGNMENT_INCLUDE = {
  assignments: {
    where: { status: "ACTIVE" as const },
    orderBy: { startDate: "desc" as const },
    take: 1,
    include: { worker: true, client: true, site: true },
  },
  coordinator: true,
};

export async function listVehicles(
  user: SessionUser,
  params: { search?: string; status?: VehicleStatus | "ALL"; page?: number; pageSize?: number },
) {
  assertCan(user, "view", "vehicle");
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;

  const where: Prisma.VehicleWhereInput = {
    deletedAt: null,
    ...vehicleScopeWhere(user),
    ...(params.status && params.status !== "ALL" ? { status: params.status } : {}),
    ...buildVehicleSearchWhere(params.search),
  };

  const [vehicles, total] = await Promise.all([
    db.vehicle.findMany({
      where,
      include: CURRENT_ASSIGNMENT_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.vehicle.count({ where }),
  ]);

  return { vehicles, total, page, pageSize };
}

export async function getVehicle(user: SessionUser, id: string) {
  assertCan(user, "view", "vehicle");
  const vehicle = await db.vehicle.findFirst({
    where: { id, deletedAt: null, ...vehicleScopeWhere(user) },
    include: {
      coordinator: true,
      assignments: {
        orderBy: { startDate: "desc" },
        include: { worker: true, client: true, project: true, site: true, coordinator: true },
      },
      expenses: {
        where: { deletedAt: null },
        orderBy: { date: "desc" },
        include: { worker: true, client: true, site: true },
      },
      maintenance: { orderBy: { createdAt: "desc" } },
      documents: { orderBy: { uploadedAt: "desc" } },
    },
  });
  return vehicle;
}

export async function listVehiclesForSelect(user: SessionUser, params?: { onlyAvailable?: boolean }) {
  assertCan(user, "view", "vehicle");
  return db.vehicle.findMany({
    where: {
      deletedAt: null,
      ...vehicleScopeWhere(user),
      ...(params?.onlyAvailable ? { status: "AVAILABLE" } : {}),
    },
    orderBy: { plateNumber: "asc" },
    select: { id: true, plateNumber: true, make: true, model: true, status: true, sequenceNo: true },
  });
}

export async function listVehicleAssignmentsForWorker(workerId: string) {
  return db.vehicleAssignment.findMany({
    where: { workerId },
    orderBy: { startDate: "desc" },
    include: { vehicle: true, client: true, site: true },
  });
}

export async function listVehiclesForCoordinator(coordinatorId: string) {
  return db.vehicle.findMany({
    where: { coordinatorId, deletedAt: null },
    orderBy: { plateNumber: "asc" },
    include: CURRENT_ASSIGNMENT_INCLUDE,
  });
}

export async function listVehiclesAtSite(siteId: string) {
  return db.vehicleAssignment.findMany({
    where: { siteId, status: "ACTIVE" },
    orderBy: { startDate: "desc" },
    include: { vehicle: true, worker: true },
  });
}

// Sum of all non-deleted expenses for a vehicle, used by the profitability
// calc engine (§4: "Profitability = Revenue - Worker Cost - Vehicle
// Expenses - ..."). Never cached/stored — always derived on read.
export async function getVehicleExpenseTotal(vehicleId: string) {
  const result = await db.vehicleExpense.aggregate({
    where: { vehicleId, deletedAt: null },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

export async function getVehicleExpenseTotalForSite(siteId: string) {
  const result = await db.vehicleExpense.aggregate({
    where: { siteId, deletedAt: null },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

export async function getVehicleExpenseTotalForClient(clientId: string) {
  const result = await db.vehicleExpense.aggregate({
    where: { clientId, deletedAt: null },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

export async function listUpcomingVehicleDocumentExpiries(daysAhead = 30) {
  const now = new Date();
  const horizon = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const [documents, vehicles] = await Promise.all([
    db.vehicleDocument.findMany({
      where: { expiryDate: { gte: now, lte: horizon } },
      include: { vehicle: true },
      orderBy: { expiryDate: "asc" },
    }),
    db.vehicle.findMany({
      where: {
        deletedAt: null,
        OR: [
          { registrationExpiry: { gte: now, lte: horizon } },
          { insuranceExpiry: { gte: now, lte: horizon } },
          { inspectionExpiry: { gte: now, lte: horizon } },
        ],
      },
    }),
  ]);
  return { documents, vehicles };
}

export async function listUpcomingVehicleMaintenance(daysAhead = 30) {
  const now = new Date();
  const horizon = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  return db.vehicleMaintenance.findMany({
    where: {
      status: { in: ["SCHEDULED", "IN_PROGRESS"] },
      nextServiceDate: { gte: now, lte: horizon },
    },
    include: { vehicle: true },
    orderBy: { nextServiceDate: "asc" },
  });
}
