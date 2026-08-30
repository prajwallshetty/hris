import { auth } from "@/auth";
import type { SessionUser } from "@/server/rbac";

export class UnauthenticatedError extends Error {
  constructor() {
    super("You must be signed in to do that.");
    this.name = "UnauthenticatedError";
  }
}

export async function getSessionUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  return {
    id: session.user.id,
    role: session.user.role,
    coordinatorId: session.user.coordinatorId,
    clientId: session.user.clientId,
  };
}
