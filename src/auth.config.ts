import type { NextAuthConfig } from "next-auth";

// Split out so `proxy.ts` (Edge runtime) can check auth state without
// pulling in the Credentials provider / bcrypt / Prisma, none of which
// run on the Edge runtime.
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = request.nextUrl.pathname.startsWith("/login");
      // The login page itself redirects signed-in users (it can check the
      // database for revoked sessions; this Edge check only decodes the JWT,
      // so redirecting here would loop a revoked session between the two).
      if (isOnLogin) return true;
      return isLoggedIn;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
