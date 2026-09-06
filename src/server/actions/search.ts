"use server";

import { db } from "@/lib/db";
import {
  can,
  clientScopeWhere,
  coordinatorScopeWhere,
  equipmentRentalScopeWhere,
  equipmentScopeWhere,
  invoiceScopeWhere,
  vehicleScopeWhere,
  workerScopeWhere,
} from "@/server/rbac";
import { getSessionUser } from "@/server/session";

export type SearchResultGroup = {
  label: string;
  items: { id: string; label: string; sublabel?: string; href: string }[];
};

const LIMIT = 5;

/** §38 global search — Ctrl/Cmd+K. Each category is scoped exactly like its own list page. */
export async function globalSearch(query: string): Promise<SearchResultGroup[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const user = await getSessionUser();
  const groups: SearchResultGroup[] = [];

  if (can(user, "view", "worker")) {
    const workers = await db.worker.findMany({
      where: {
        deletedAt: null,
        ...workerScopeWhere(user),
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          { iqamaNumber: { contains: q } },
        ],
      },
      select: { id: true, fullName: true, iqamaNumber: true },
      take: LIMIT,
    });
    if (workers.length > 0) {
      groups.push({
        label: "Workers",
        items: workers.map((w) => ({ id: w.id, label: w.fullName, sublabel: w.iqamaNumber, href: `/workers/${w.id}` })),
      });
    }
  }

  if (can(user, "view", "client")) {
    const clients = await db.client.findMany({
      where: { deletedAt: null, ...clientScopeWhere(user), companyName: { contains: q, mode: "insensitive" } },
      select: { id: true, companyName: true },
      take: LIMIT,
    });
    if (clients.length > 0) {
      groups.push({
        label: "Clients",
        items: clients.map((c) => ({ id: c.id, label: c.companyName, href: `/clients/${c.id}` })),
      });
    }
  }

  if (can(user, "view", "site")) {
    const sites = await db.site.findMany({
      where: { deletedAt: null, name: { contains: q, mode: "insensitive" } },
      select: { id: true, name: true, project: { select: { name: true, client: { select: { companyName: true } } } } },
      take: LIMIT,
    });
    if (sites.length > 0) {
      groups.push({
        label: "Sites",
        items: sites.map((s) => ({
          id: s.id,
          label: s.name,
          sublabel: `${s.project.client.companyName} / ${s.project.name}`,
          href: `/clients`,
        })),
      });
    }
  }

  if (can(user, "view", "coordinator")) {
    const coordinators = await db.coordinator.findMany({
      where: { ...coordinatorScopeWhere(user), name: { contains: q, mode: "insensitive" } },
      select: { id: true, name: true },
      take: LIMIT,
    });
    if (coordinators.length > 0) {
      groups.push({
        label: "Coordinators",
        items: coordinators.map((c) => ({ id: c.id, label: c.name, href: `/coordinators/${c.id}` })),
      });
    }
  }

  if (can(user, "view", "invoice")) {
    const numeric = Number(q);
    const invoices = await db.invoice.findMany({
      where: {
        ...invoiceScopeWhere(user),
        ...(Number.isInteger(numeric) ? { sequenceNo: numeric } : { client: { companyName: { contains: q, mode: "insensitive" } } }),
      },
      select: { id: true, sequenceNo: true, totalAmount: true, client: { select: { companyName: true } } },
      take: LIMIT,
    });
    if (invoices.length > 0) {
      groups.push({
        label: "Invoices",
        items: invoices.map((inv) => ({
          id: inv.id,
          label: `Invoice #${inv.sequenceNo}`,
          sublabel: inv.client.companyName,
          href: `/invoices/${inv.id}`,
        })),
      });
    }
  }

  if (can(user, "view", "employee")) {
    const employees = await db.internalEmployee.findMany({
      where: { deletedAt: null, fullName: { contains: q, mode: "insensitive" } },
      select: { id: true, fullName: true },
      take: LIMIT,
    });
    if (employees.length > 0) {
      groups.push({
        label: "Employees",
        items: employees.map((e) => ({ id: e.id, label: e.fullName, href: `/employees/${e.id}` })),
      });
    }
  }

  if (can(user, "view", "vehicle")) {
    const vehicles = await db.vehicle.findMany({
      where: {
        deletedAt: null,
        ...vehicleScopeWhere(user),
        OR: [
          { plateNumber: { contains: q, mode: "insensitive" } },
          { vin: { contains: q, mode: "insensitive" } },
          { make: { contains: q, mode: "insensitive" } },
          { model: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, plateNumber: true, make: true, model: true },
      take: LIMIT,
    });
    if (vehicles.length > 0) {
      groups.push({
        label: "Vehicles",
        items: vehicles.map((v) => ({
          id: v.id,
          label: v.plateNumber,
          sublabel: `${v.make} ${v.model}`,
          href: `/vehicles/${v.id}`,
        })),
      });
    }
  }

  if (can(user, "view", "equipment")) {
    const equipment = await db.equipment.findMany({
      where: {
        deletedAt: null,
        ...equipmentScopeWhere(user),
        OR: [
          { serialNumber: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, serialNumber: true },
      take: LIMIT,
    });
    if (equipment.length > 0) {
      groups.push({
        label: "Equipment",
        items: equipment.map((e) => ({
          id: e.id,
          label: e.name,
          sublabel: e.serialNumber,
          href: `/equipment/${e.id}`,
        })),
      });
    }
  }

  if (can(user, "view", "equipmentRental")) {
    const rentalMatch = Number(q);
    const rentals = await db.equipmentRental.findMany({
      where: {
        ...equipmentRentalScopeWhere(user),
        ...(Number.isInteger(rentalMatch)
          ? { sequenceNo: rentalMatch }
          : {
              OR: [
                { equipment: { name: { contains: q, mode: "insensitive" } } },
                { client: { companyName: { contains: q, mode: "insensitive" } } },
              ],
            }),
      },
      select: { id: true, sequenceNo: true, equipment: { select: { name: true } }, client: { select: { companyName: true } } },
      take: LIMIT,
    });
    if (rentals.length > 0) {
      groups.push({
        label: "Rentals",
        items: rentals.map((r) => ({
          id: r.id,
          label: `Rental #${r.sequenceNo} — ${r.equipment.name}`,
          sublabel: r.client.companyName,
          href: `/rentals/${r.id}`,
        })),
      });
    }
  }

  return groups;
}
