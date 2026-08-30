import NextAuth from "next-auth";

import { authConfig } from "@/auth.config";

// Next.js 16 renamed `middleware.ts` to `proxy.ts`. This runs on the Edge
// runtime, so it only checks the JWT via `authConfig` (no Prisma/bcrypt) —
// the full DB-backed status re-check happens in `src/auth.ts`'s jwt
// callback, which runs in the Node runtime on every server request.
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login).*)"],
};
