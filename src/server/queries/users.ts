import { db } from "@/lib/db";
import { assertCan, type SessionUser } from "@/server/rbac";

export async function listUsers(user: SessionUser) {
  assertCan(user, "view", "user");
  return db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      accessCodeSetAt: true,
      coordinator: { select: { id: true, name: true } },
      client: { select: { id: true, companyName: true } },
      createdAt: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function getUser(user: SessionUser, id: string) {
  assertCan(user, "view", "user");
  return db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      accessCodeSetAt: true,
      coordinatorId: true,
      clientId: true,
      createdAt: true,
    },
  });
}

/** Recent login activity for a user, for the Users admin page — never includes the code itself. */
export async function listUserAuthAttempts(user: SessionUser, userId: string, limit = 20) {
  assertCan(user, "view", "user");
  return db.authAttempt.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
