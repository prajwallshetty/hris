import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { pickCoordinator, type CoordinatorSource } from "@/lib/coordinator-resolution";

type DbClient = Prisma.TransactionClient | typeof db;

export type ResolvedCoordinator = {
  coordinatorId: string | null;
  coordinatorName: string | null;
  source: CoordinatorSource;
};

/**
 * Looks up the coordinator for a client / project from the database
 * (Project → Client → none). With only a client given it answers from the
 * client alone. A project that doesn't belong to the client is ignored
 * rather than trusted. An INACTIVE coordinator is skipped, as if unset.
 */
export async function resolvePlacementCoordinator(
  client: DbClient,
  input: { clientId?: string | null; projectId?: string | null },
): Promise<ResolvedCoordinator> {
  const activeOnly = { select: { id: true, name: true, status: true } } as const;

  const project = input.projectId
    ? await client.project.findFirst({
        where: { id: input.projectId, deletedAt: null, ...(input.clientId ? { clientId: input.clientId } : {}) },
        select: { coordinator: activeOnly, client: { select: { coordinator: activeOnly } } },
      })
    : null;
  const clientRow =
    !project && input.clientId
      ? await client.client.findFirst({ where: { id: input.clientId, deletedAt: null }, select: { coordinator: activeOnly } })
      : null;

  const projectCoordinator = project?.coordinator?.status === "ACTIVE" ? project.coordinator : null;
  const clientCoordinatorRow = project?.client.coordinator ?? clientRow?.coordinator ?? null;
  const clientCoordinator = clientCoordinatorRow?.status === "ACTIVE" ? clientCoordinatorRow : null;

  const picked = pickCoordinator({
    projectCoordinatorId: projectCoordinator?.id,
    clientCoordinatorId: clientCoordinator?.id,
  });
  const name = picked.source === "project" ? projectCoordinator?.name : picked.source === "client" ? clientCoordinator?.name : null;
  return { coordinatorId: picked.coordinatorId, coordinatorName: name ?? null, source: picked.source };
}
