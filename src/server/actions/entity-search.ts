"use server";

import { db } from "@/lib/db";
import {
  can,
  clientScopeWhere,
  coordinatorScopeWhere,
  equipmentScopeWhere,
  invoiceScopeWhere,
  vehicleScopeWhere,
  workerScopeWhere,
} from "@/server/rbac";
import { getSessionUser } from "@/server/session";

export type WorkerOption = {
  id: string;
  fullName: string;
  iqamaNumber: string;
  hourlyRate?: number | null;
  designationTitle?: string | null;
  status: string;
};

export type ClientOption = {
  id: string;
  companyName: string;
  contactPerson?: string | null;
};

export type ProjectOption = {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
};

export type SiteOption = {
  id: string;
  name: string;
  location?: string | null;
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
};

export type CoordinatorOption = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
};

export type VehicleOption = {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  vin?: string | null;
  status: string;
};

export type EquipmentOption = {
  id: string;
  name: string;
  serialNumber: string;
  category?: string | null;
  status: string;
};

export type EmployeeOption = {
  id: string;
  fullName: string;
  sequenceNo: number;
  departmentName?: string | null;
  designationTitle?: string | null;
};

export type InvoiceOption = {
  id: string;
  sequenceNo: number;
  invoiceNumber: string;
  clientName: string;
  totalAmount: number;
};

const DEFAULT_LIMIT = 20;

export async function searchWorkerOptions(
  query: string = "",
  filters?: { coordinatorId?: string; status?: string; limit?: number }
): Promise<WorkerOption[]> {
  const user = await getSessionUser();
  if (!can(user, "view", "worker")) return [];

  const q = query.trim();
  const limit = Math.min(filters?.limit ?? DEFAULT_LIMIT, 50);

  const whereClause: Record<string, unknown> = {
    deletedAt: null,
    ...workerScopeWhere(user),
  };

  if (filters?.coordinatorId) {
    whereClause.coordinatorId = filters.coordinatorId;
  }
  if (filters?.status && filters.status !== "ALL") {
    whereClause.status = filters.status;
  }

  if (q.length > 0) {
    whereClause.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { iqamaNumber: { contains: q } },
      { passportNumber: { contains: q, mode: "insensitive" } },
    ];
  }

  const workers = await db.worker.findMany({
    where: whereClause,
    select: {
      id: true,
      fullName: true,
      iqamaNumber: true,
      hourlyRate: true,
      status: true,
      designation: { select: { title: true } },
    },
    orderBy: { fullName: "asc" },
    take: limit,
  });

  return workers.map((w) => ({
    id: w.id,
    fullName: w.fullName,
    iqamaNumber: w.iqamaNumber,
    hourlyRate: w.hourlyRate ? Number(w.hourlyRate) : null,
    designationTitle: w.designation?.title ?? null,
    status: w.status,
  }));
}

export async function searchClientOptions(
  query: string = "",
  filters?: { limit?: number }
): Promise<ClientOption[]> {
  const user = await getSessionUser();
  if (!can(user, "view", "client")) return [];

  const q = query.trim();
  const limit = Math.min(filters?.limit ?? DEFAULT_LIMIT, 50);

  const whereClause: Record<string, unknown> = {
    deletedAt: null,
    status: "ACTIVE",
    ...clientScopeWhere(user),
  };

  if (q.length > 0) {
    whereClause.companyName = { contains: q, mode: "insensitive" };
  }

  const clients = await db.client.findMany({
    where: whereClause,
    select: {
      id: true,
      companyName: true,
      contactPerson: true,
    },
    orderBy: { companyName: "asc" },
    take: limit,
  });

  return clients.map((c) => ({
    id: c.id,
    companyName: c.companyName,
    contactPerson: c.contactPerson ?? null,
  }));
}

export async function searchProjectOptions(
  query: string = "",
  filters?: { clientId?: string; limit?: number }
): Promise<ProjectOption[]> {
  const user = await getSessionUser();
  if (!can(user, "view", "project")) return [];

  const q = query.trim();
  const limit = Math.min(filters?.limit ?? DEFAULT_LIMIT, 50);

  const whereClause: Record<string, unknown> = {
    deletedAt: null,
    status: "ACTIVE",
  };

  if (filters?.clientId) {
    whereClause.clientId = filters.clientId;
  }
  if (user.clientId) {
    whereClause.clientId = user.clientId;
  }

  if (q.length > 0) {
    whereClause.name = { contains: q, mode: "insensitive" };
  }

  const projects = await db.project.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      clientId: true,
      client: { select: { companyName: true } },
    },
    orderBy: { name: "asc" },
    take: limit,
  });

  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    clientId: p.clientId,
    clientName: p.client.companyName,
  }));
}

export async function searchSiteOptions(
  query: string = "",
  filters?: { projectId?: string; clientId?: string; limit?: number }
): Promise<SiteOption[]> {
  const user = await getSessionUser();
  if (!can(user, "view", "site")) return [];

  const q = query.trim();
  const limit = Math.min(filters?.limit ?? DEFAULT_LIMIT, 50);

  const whereClause: Record<string, unknown> = {
    deletedAt: null,
    status: "ACTIVE",
  };

  if (filters?.projectId) {
    whereClause.projectId = filters.projectId;
  }
  if (filters?.clientId) {
    whereClause.project = { clientId: filters.clientId };
  }
  if (user.clientId) {
    whereClause.project = { ...(whereClause.project || {}), clientId: user.clientId };
  }

  if (q.length > 0) {
    whereClause.name = { contains: q, mode: "insensitive" };
  }

  const sites = await db.site.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      location: true,
      projectId: true,
      project: {
        select: {
          name: true,
          clientId: true,
          client: { select: { companyName: true } },
        },
      },
    },
    orderBy: { name: "asc" },
    take: limit,
  });

  return sites.map((s) => ({
    id: s.id,
    name: s.name,
    location: s.location ?? null,
    projectId: s.projectId,
    projectName: s.project.name,
    clientId: s.project.clientId,
    clientName: s.project.client.companyName,
  }));
}

export async function searchCoordinatorOptions(
  query: string = "",
  filters?: { limit?: number }
): Promise<CoordinatorOption[]> {
  const user = await getSessionUser();
  if (!can(user, "view", "coordinator")) return [];

  const q = query.trim();
  const limit = Math.min(filters?.limit ?? DEFAULT_LIMIT, 50);

  const whereClause: Record<string, unknown> = {
    status: "ACTIVE",
    ...coordinatorScopeWhere(user),
  };

  if (q.length > 0) {
    whereClause.name = { contains: q, mode: "insensitive" };
  }

  const coordinators = await db.coordinator.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
    },
    orderBy: { name: "asc" },
    take: limit,
  });

  return coordinators.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone ?? null,
    email: c.email ?? null,
  }));
}

export async function searchVehicleOptions(
  query: string = "",
  filters?: { coordinatorId?: string; availableOnly?: boolean; limit?: number }
): Promise<VehicleOption[]> {
  const user = await getSessionUser();
  if (!can(user, "view", "vehicle")) return [];

  const q = query.trim();
  const limit = Math.min(filters?.limit ?? DEFAULT_LIMIT, 50);

  const whereClause: Record<string, unknown> = {
    deletedAt: null,
    ...vehicleScopeWhere(user),
  };

  if (filters?.coordinatorId) {
    whereClause.coordinatorId = filters.coordinatorId;
  }
  if (filters?.availableOnly) {
    whereClause.status = "AVAILABLE";
  }

  if (q.length > 0) {
    whereClause.OR = [
      { plateNumber: { contains: q, mode: "insensitive" } },
      { make: { contains: q, mode: "insensitive" } },
      { model: { contains: q, mode: "insensitive" } },
      { vin: { contains: q, mode: "insensitive" } },
    ];
  }

  const vehicles = await db.vehicle.findMany({
    where: whereClause,
    select: {
      id: true,
      plateNumber: true,
      make: true,
      model: true,
      vin: true,
      status: true,
    },
    orderBy: { plateNumber: "asc" },
    take: limit,
  });

  return vehicles.map((v) => ({
    id: v.id,
    plateNumber: v.plateNumber,
    make: v.make,
    model: v.model,
    vin: v.vin ?? null,
    status: v.status,
  }));
}

export async function searchEquipmentOptions(
  query: string = "",
  filters?: { coordinatorId?: string; availableOnly?: boolean; limit?: number }
): Promise<EquipmentOption[]> {
  const user = await getSessionUser();
  if (!can(user, "view", "equipment")) return [];

  const q = query.trim();
  const limit = Math.min(filters?.limit ?? DEFAULT_LIMIT, 50);

  const whereClause: Record<string, unknown> = {
    deletedAt: null,
    ...equipmentScopeWhere(user),
  };

  if (filters?.coordinatorId) {
    whereClause.coordinatorId = filters.coordinatorId;
  }
  if (filters?.availableOnly) {
    whereClause.status = "AVAILABLE";
  }

  if (q.length > 0) {
    whereClause.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { serialNumber: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } },
    ];
  }

  const equipmentList = await db.equipment.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      serialNumber: true,
      category: true,
      status: true,
    },
    orderBy: { name: "asc" },
    take: limit,
  });

  return equipmentList.map((e) => ({
    id: e.id,
    name: e.name,
    serialNumber: e.serialNumber,
    category: e.category ?? null,
    status: e.status,
  }));
}

export async function searchEmployeeOptions(
  query: string = "",
  filters?: { departmentId?: string; status?: string; limit?: number }
): Promise<EmployeeOption[]> {
  const user = await getSessionUser();
  if (!can(user, "view", "employee")) return [];

  const q = query.trim();
  const limit = Math.min(filters?.limit ?? DEFAULT_LIMIT, 50);

  const whereClause: Record<string, unknown> = {
    deletedAt: null,
    status: filters?.status ?? "ACTIVE",
  };

  if (filters?.departmentId) {
    whereClause.departmentId = filters.departmentId;
  }

  if (q.length > 0) {
    whereClause.fullName = { contains: q, mode: "insensitive" };
  }

  const employees = await db.internalEmployee.findMany({
    where: whereClause,
    select: {
      id: true,
      fullName: true,
      sequenceNo: true,
      department: { select: { name: true } },
      designation: { select: { title: true } },
    },
    orderBy: { fullName: "asc" },
    take: limit,
  });

  return employees.map((e) => ({
    id: e.id,
    fullName: e.fullName,
    sequenceNo: e.sequenceNo,
    departmentName: e.department?.name ?? null,
    designationTitle: e.designation?.title ?? null,
  }));
}

export async function searchInvoiceOptions(
  query: string = "",
  filters?: { clientId?: string; limit?: number }
): Promise<InvoiceOption[]> {
  const user = await getSessionUser();
  if (!can(user, "view", "invoice")) return [];

  const q = query.trim();
  const limit = Math.min(filters?.limit ?? DEFAULT_LIMIT, 50);

  const whereClause: Record<string, unknown> = {
    ...invoiceScopeWhere(user),
  };

  if (filters?.clientId) {
    whereClause.clientId = filters.clientId;
  }

  if (q.length > 0) {
    const num = Number(q);
    if (!isNaN(num)) {
      whereClause.sequenceNo = num;
    } else {
      whereClause.client = { companyName: { contains: q, mode: "insensitive" } };
    }
  }

  const invoices = await db.invoice.findMany({
    where: whereClause,
    select: {
      id: true,
      sequenceNo: true,
      totalAmount: true,
      client: { select: { companyName: true } },
    },
    orderBy: { sequenceNo: "desc" },
    take: limit,
  });

  return invoices.map((inv) => ({
    id: inv.id,
    sequenceNo: inv.sequenceNo,
    invoiceNumber: `INV-${inv.sequenceNo}`,
    clientName: inv.client.companyName,
    totalAmount: Number(inv.totalAmount),
  }));
}

export async function getEntityLabel(
  type:
    | "worker"
    | "client"
    | "project"
    | "site"
    | "coordinator"
    | "vehicle"
    | "equipment"
    | "employee"
    | "invoice",
  id: string
): Promise<{ title: string; subtitle?: string } | null> {
  if (!id) return null;

  try {
    switch (type) {
      case "worker": {
        const w = await db.worker.findUnique({
          where: { id },
          select: { fullName: true, iqamaNumber: true },
        });
        return w ? { title: w.fullName, subtitle: `Iqama: ${w.iqamaNumber}` } : null;
      }
      case "client": {
        const c = await db.client.findUnique({
          where: { id },
          select: { companyName: true },
        });
        return c ? { title: c.companyName } : null;
      }
      case "project": {
        const p = await db.project.findUnique({
          where: { id },
          select: { name: true, client: { select: { companyName: true } } },
        });
        return p ? { title: p.name, subtitle: p.client.companyName } : null;
      }
      case "site": {
        const s = await db.site.findUnique({
          where: { id },
          select: {
            name: true,
            project: { select: { name: true, client: { select: { companyName: true } } } },
          },
        });
        return s ? { title: s.name, subtitle: `${s.project.client.companyName} — ${s.project.name}` } : null;
      }
      case "coordinator": {
        const coord = await db.coordinator.findUnique({
          where: { id },
          select: { name: true, phone: true },
        });
        return coord ? { title: coord.name, subtitle: coord.phone ?? undefined } : null;
      }
      case "vehicle": {
        const v = await db.vehicle.findUnique({
          where: { id },
          select: { plateNumber: true, make: true, model: true },
        });
        return v ? { title: v.plateNumber, subtitle: `${v.make} ${v.model}` } : null;
      }
      case "equipment": {
        const e = await db.equipment.findUnique({
          where: { id },
          select: { name: true, serialNumber: true },
        });
        return e ? { title: e.name, subtitle: `S/N: ${e.serialNumber}` } : null;
      }
      case "employee": {
        const emp = await db.internalEmployee.findUnique({
          where: { id },
          select: { fullName: true, department: { select: { name: true } } },
        });
        return emp ? { title: emp.fullName, subtitle: emp.department?.name ?? undefined } : null;
      }
      case "invoice": {
        const inv = await db.invoice.findUnique({
          where: { id },
          select: { sequenceNo: true, client: { select: { companyName: true } } },
        });
        return inv ? { title: `INV-${inv.sequenceNo}`, subtitle: inv.client.companyName } : null;
      }
    }
  } catch {
    return null;
  }
}
