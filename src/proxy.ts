import NextAuth from "next-auth";

import { authConfig } from "@/auth.config";

// Next.js 16 renamed `middleware.ts` to `proxy.ts`. This runs on the Edge
// runtime, so it only checks the JWT via `authConfig` (no Prisma/bcrypt) —
// the full DB-backed status re-check happens in `src/auth.ts`'s jwt
// callback, which runs in the Node runtime on every server request.
const { auth } = NextAuth(authConfig);

export default auth;

// `/branding` (and any other static file under /public — logo, icons,
// fonts) must never require auth: unauthenticated pages like /login render
// the logo too, and this middleware would otherwise redirect that asset
// request to /login itself (§ branding bugfix).
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|branding|favicon.ico|login|.*\\.(?:png|jpg|jpeg|svg|webp|ico|gif)$).*)",
  ],
};
