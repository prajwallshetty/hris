#!/usr/bin/env node
// Runs `prisma migrate deploy` on Vercel's production builds only.
// VERCEL_ENV is a Vercel system env var ("production" | "preview" |
// "development") available at build time with no configuration needed —
// preview/branch deployments and local `npm run build` never see
// "production", so they never touch the database.
//
// A migration failure here fails the BUILD, on purpose: it's safer to
// block a broken deploy than to ship app code that queries a column the
// database doesn't have yet, which is exactly the bug this script exists
// to stop happening again.
import { execSync } from "node:child_process";

if (process.env.VERCEL_ENV === "production") {
  console.log("[migrate] VERCEL_ENV=production — running `prisma migrate deploy`…");
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
} else {
  console.log(`[migrate] Skipping migrate deploy (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}).`);
}
