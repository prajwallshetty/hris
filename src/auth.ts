import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { authConfig } from "@/auth.config";
import { db } from "@/lib/db";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
        if (!user || user.status !== "ACTIVE") return null;

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) return null;

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
