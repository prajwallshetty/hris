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
      if (isOnLogin) {
        return !isLoggedIn || Response.redirect(new URL("/dashboard", request.nextUrl));
      }
      return isLoggedIn;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
