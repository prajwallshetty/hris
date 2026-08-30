import { Prisma } from "@prisma/client";

import { ForbiddenError } from "@/server/rbac";
import { UnauthenticatedError } from "@/server/session";

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

// Never leak raw DB/backend error text to the client (§32) — map known
// error shapes to a friendly message and fall back to a generic one.
export function actionError(error: unknown): ActionResult<never> {
  if (error instanceof ForbiddenError || error instanceof UnauthenticatedError) {
    return { success: false, error: error.message };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = (error.meta?.target as string[] | undefined)?.join(", ") ?? "value";
      return { success: false, error: `A record with this ${target} already exists.` };
    }
    if (error.code === "P2003") {
      return { success: false, error: "This action references a record that no longer exists." };
    }
    if (error.code === "P2025") {
      return { success: false, error: "That record could not be found — it may have been removed." };
    }
  }
  console.error(error);
  return { success: false, error: "Something went wrong. Please try again." };
}
