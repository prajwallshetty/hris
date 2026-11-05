"use server";

import { db } from "@/lib/db";
import { actionError, ok, type ActionResult } from "@/server/action-result";
import { resolvePlacementCoordinator, type ResolvedCoordinator } from "@/server/coordinator-resolution";
import { assertCan } from "@/server/rbac";
import { getSessionUser } from "@/server/session";

/**
 * The coordinator a form should pre-fill once a client (and optionally a
 * project) is chosen. Read-only; the form decides whether to apply it, so a
 * manual choice is never overwritten by this lookup.
 */
export async function suggestCoordinator(input: {
  clientId?: string;
  projectId?: string;
}): Promise<ActionResult<ResolvedCoordinator>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "view", "worker");
    return ok(await resolvePlacementCoordinator(db, input));
  } catch (error) {
    return actionError(error);
  }
}
