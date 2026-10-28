import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { assertCan, clientScopeWhere, projectScopeWhere, type SessionUser } from "@/server/rbac";

export async function listClients(user: SessionUser, params: { search?: string } = {}) {
  assertCan(user, "view", "client");

  const where: Prisma.ClientWhereInput = {
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
    where: { id, ...clientScopeWhere(user) },
    include: {
      projects: {
        orderBy: { name: "asc" },
        include: {
          coordinator: { select: { id: true, name: true } },
          sites: {
            orderBy: { name: "asc" },
            include: {
              _count: {
                select: {
                  assignments: { where: { status: "ACTIVE" } },
                  vehicleAssignments: { where: { status: "ACTIVE" } },
                },
              },
            },
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

// Standalone Projects overview (§Quick Access shortcut) — every project
// across every client in one list, reusing the same Project/Client/Site/
// Coordinator relations and RBAC scoping as the per-client tab, not a
// separate read model.
export async function listProjectsOverview(user: SessionUser, params: { search?: string } = {}) {
  assertCan(user, "view", "project");

  const where: Prisma.ProjectWhereInput = {
    deletedAt: null,
    ...projectScopeWhere(user),
    ...(params.search
      ? {
          OR: [
            { name: { contains: params.search, mode: "insensitive" } },
            { client: { companyName: { contains: params.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  return db.project.findMany({
    where,
    include: {
      client: { select: { id: true, companyName: true } },
      coordinator: { select: { id: true, name: true } },
      _count: {
        select: {
          sites: { where: { deletedAt: null } },
          assignments: { where: { status: "ACTIVE" } },
        },
      },
    },
    orderBy: [{ client: { companyName: "asc" } }, { name: "asc" }],
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
