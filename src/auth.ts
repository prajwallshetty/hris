import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { headers } from "next/headers";
import { z } from "zod";

import { authConfig } from "@/auth.config";
import { accessCodeLookupHash, isWellFormedAccessCode, verifyAccessCode } from "@/lib/access-code";
import { db } from "@/lib/db";

// Distinguishable failures from authorize() (§1 login states) — CredentialsSignin's
// `code` is safe to surface to the client per its own doc comment (it's the only
// thing that reaches the browser; the full reason is also written to AuthAttempt).
export class InvalidAccessCodeError extends CredentialsSignin {
  code = "invalid_code";
}
export class AccountDisabledError extends CredentialsSignin {
  code = "account_disabled";
}
export class RateLimitedError extends CredentialsSignin {
  code = "rate_limited";
}

const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_MAX_FAILURES = 5;

const credentialsSchema = z.object({
  accessCode: z.string().min(1),
});

async function getClientIp(): Promise<string | undefined> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? undefined;
}

async function logAttempt(params: {
  userId: string | null;
  codePrefix: string | null;
  ip: string | undefined;
  success: boolean;
  reason: string;
}) {
  await db.authAttempt.create({
    data: {
      userId: params.userId,
      codePrefix: params.codePrefix,
      ipAddress: params.ip,
      success: params.success,
      reason: params.reason,
    },
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        accessCode: { label: "Access Code", type: "text" },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) throw new InvalidAccessCodeError();
        const { accessCode } = parsed.data;
        const ip = await getClientIp();
        const codePrefix = accessCode.trim().toUpperCase().split("-")[0]?.slice(0, 4) || null;

        // Rate limit by IP first — cheap, and avoids doing a bcrypt compare
        // (or even a DB lookup) once an IP is already locked out (§1).
        const recentFailures = await db.authAttempt.count({
          where: {
            ipAddress: ip,
            success: false,
            createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000) },
          },
        });
        if (ip && recentFailures >= RATE_LIMIT_MAX_FAILURES) {
          await logAttempt({ userId: null, codePrefix, ip, success: false, reason: "rate_limited" });
          throw new RateLimitedError();
        }

        if (!isWellFormedAccessCode(accessCode)) {
          await logAttempt({ userId: null, codePrefix, ip, success: false, reason: "invalid_code" });
          throw new InvalidAccessCodeError();
        }

        const user = await db.user.findUnique({ where: { accessCodeLookupHash: accessCodeLookupHash(accessCode) } });
        if (!user) {
          await logAttempt({ userId: null, codePrefix, ip, success: false, reason: "invalid_code" });
          throw new InvalidAccessCodeError();
        }

        if (user.status !== "ACTIVE") {
          await logAttempt({ userId: user.id, codePrefix, ip, success: false, reason: "account_disabled" });
          throw new AccountDisabledError();
        }

        if (!user.accessCodeHash) {
          // No code has been issued yet — surfaces identically to "invalid" so
          // this can't be used to enumerate which accounts are activated.
          await logAttempt({ userId: user.id, codePrefix, ip, success: false, reason: "no_code_set" });
          throw new InvalidAccessCodeError();
        }

        const matches = await verifyAccessCode(accessCode, user.accessCodeHash);
        if (!matches) {
          await logAttempt({ userId: user.id, codePrefix, ip, success: false, reason: "invalid_code" });
          throw new InvalidAccessCodeError();
        }

        await logAttempt({ userId: user.id, codePrefix, ip, success: true, reason: "success" });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          coordinatorId: user.coordinatorId,
          clientId: user.clientId,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.coordinatorId = user.coordinatorId;
        token.clientId = user.clientId;
        return token;
      }

      // Re-check status on every request so a suspended/deactivated user
      // loses access promptly instead of riding out the JWT's lifetime.
      const dbUser = await db.user.findUnique({ where: { id: token.sub } });
      if (!dbUser || dbUser.status !== "ACTIVE") {
        return null;
      }
      token.role = dbUser.role;
      token.coordinatorId = dbUser.coordinatorId;
      token.clientId = dbUser.clientId;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role;
        session.user.coordinatorId = token.coordinatorId;
        session.user.clientId = token.clientId;
      }
      return session;
    },
  },
});
