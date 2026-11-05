// Which coordinator a new placement defaults to (§ coordinator assignment).
// Pure and client-safe so the form, the server action and the bulk importer
// all apply exactly the same rule.

export type CoordinatorSource = "manual" | "project" | "client" | "none";

export const COORDINATOR_SOURCE_LABELS: Record<CoordinatorSource, string> = {
  manual: "Chosen manually",
  project: "From the project",
  client: "From the client",
  none: "Not assigned",
};

/**
 * Order of precedence:
 *  1. a coordinator someone explicitly chose — never overwritten;
 *  2. the project's own coordinator (the primary source);
 *  3. the client's coordinator, only when the project has none;
 *  4. nobody — left unassigned for manual selection.
 * Callers pass only ACTIVE coordinators' ids; an inactive one counts as none.
 */
export function pickCoordinator(input: {
  manualId?: string | null;
  projectCoordinatorId?: string | null;
  clientCoordinatorId?: string | null;
}): { coordinatorId: string | null; source: CoordinatorSource } {
  if (input.manualId) return { coordinatorId: input.manualId, source: "manual" };
  if (input.projectCoordinatorId) return { coordinatorId: input.projectCoordinatorId, source: "project" };
  if (input.clientCoordinatorId) return { coordinatorId: input.clientCoordinatorId, source: "client" };
  return { coordinatorId: null, source: "none" };
}
