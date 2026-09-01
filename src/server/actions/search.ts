"use server";

import { db } from "@/lib/db";
import {
  can,
  clientScopeWhere,
  coordinatorScopeWhere,
  invoiceScopeWhere,
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

  return groups;
}
