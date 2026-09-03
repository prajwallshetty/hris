import bcrypt from "bcryptjs";
import { createHash, randomInt } from "crypto";

import type { Role } from "@prisma/client";

// Human-typeable, role-hinting prefixes (e.g. "ADM-666"). Cosmetic only —
// the prefix is never used to derive permissions; the User row looked up
// via accessCodeLookupHash is always the source of truth for role/RBAC.
const ROLE_PREFIXES: Record<Role, string> = {
  SUPER_ADMIN: "SA",
  ADMIN: "ADM",
  HR: "HR",
  ACCOUNTS: "ACC",
  MANAGER: "MGR",
  COORDINATOR: "CO",
  CLIENT: "CLT",
  EMPLOYEE: "EMP",
};

const ACCESS_CODE_PATTERN = /^[A-Z]{2,4}-\d{3,4}$/;

export function accessCodePrefixForRole(role: Role): string {
  return ROLE_PREFIXES[role];
}

export function normalizeAccessCode(code: string): string {
  return code.trim().toUpperCase();
}

export function isWellFormedAccessCode(code: string): boolean {
  return ACCESS_CODE_PATTERN.test(normalizeAccessCode(code));
}

/** Fast, deterministic digest for O(1) row lookup — never the security boundary by itself. */
export function accessCodeLookupHash(code: string): string {
  return createHash("sha256").update(normalizeAccessCode(code)).digest("hex");
}

/** Slow, salted hash — the actual verification boundary. */
export async function hashAccessCode(code: string): Promise<string> {
  return bcrypt.hash(normalizeAccessCode(code), 12);
}

export async function verifyAccessCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(normalizeAccessCode(code), hash);
}

export function generateRandomAccessCode(role: Role): string {
  const prefix = accessCodePrefixForRole(role);
  const number = randomInt(100, 1000);
  return `${prefix}-${number}`;
}
