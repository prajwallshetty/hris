import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { assertCan, clientScopeWhere, type SessionUser } from "@/server/rbac";

export async function listClients(user: SessionUser, params: { search?: string } = {}) {
  assertCan(user, "view", "client");

  const where: Prisma.ClientWhereInput = {
    deletedAt: null,
    ...clientScopeWhere(user),
    ...(params.search
      ? { companyName: { contains: params.search, mode: "insensitive" } }
      : {}),
  };

  return db.client.findMany({
    where,
    include: {
      _count: { select: { projects: true, assignments: { where: { status: "ACTIVE" } } } },
    },
    orderBy: { companyName: "asc" },
  });
}

export async function getClient(user: SessionUser, id: string) {
  assertCan(user, "view", "client");
  return db.client.findFirst({
    where: { id, deletedAt: null, ...clientScopeWhere(user) },
    include: {
      projects: {
        where: { deletedAt: null },
        orderBy: { name: "asc" },
        include: {
          sites: {
            where: { deletedAt: null },
            orderBy: { name: "asc" },
            include: { _count: { select: { assignments: { where: { status: "ACTIVE" } } } } },
          },
        },
      },
    },
  });
}

export async function listAllClientsForSelect() {
  return db.client.findMany({
    where: { deletedAt: null, status: "ACTIVE" },
    orderBy: { companyName: "asc" },
    select: { id: true, companyName: true },
  });
}

// Full Client -> Project -> Site tree for cascading selects in the
// assignment form. The company's scale (dozens, not thousands, of clients)
// makes fetching this upfront simpler and faster than per-select round trips.
export async function listClientHierarchyForSelect() {
  return db.client.findMany({
    where: { deletedAt: null, status: "ACTIVE" },
    orderBy: { companyName: "asc" },
    select: {
      id: true,
      companyName: true,
      projects: {
        where: { deletedAt: null, status: "ACTIVE" },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          sites: {
            where: { deletedAt: null, status: "ACTIVE" },
            orderBy: { name: "asc" },
            select: { id: true, name: true },
          },
        },
      },
    },
  });
}

export async function listProjectsForClient(clientId: string) {
  return db.project.findMany({
    where: { clientId, deletedAt: null, status: "ACTIVE" },
    orderBy: { name: "asc" },
  });
}

export async function listSitesForProject(projectId: string) {
  return db.site.findMany({
    where: { projectId, deletedAt: null, status: "ACTIVE" },
    orderBy: { name: "asc" },
  });
}
