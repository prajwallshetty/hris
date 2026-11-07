#!/usr/bin/env node
// Brings the deployment's database up to the schema this build's code
// expects, before `next build` runs. Wired into `npm run build` (the Build Command pinned in vercel.json).
//
// Safety rules:
// - Local builds (VERCEL_ENV unset) never touch a database.
// - Production applies every pending migration.
// - Preview builds do NOT migrate by default. A Preview build runs against
//   whatever DATABASE_URL the preview environment has — often the same
//   database production uses — and a migration that fails there (for
//   example a column production already has) is recorded by Prisma as
//   FAILED, which then blocks every later deploy, production included
//   (P3009). Set PREVIEW_AUTO_MIGRATE=1 on the preview environment to opt
//   in, which is only appropriate when previews have their OWN database;
//   even then only additive migrations are applied.
// - A migration already recorded as FAILED stops the build with the exact
//   commands to resolve it, instead of an opaque Prisma exit code.
// - A migration failure fails the build: blocking a deploy is safer than
//   shipping code that queries a schema the database does not have.
// - Credentials are never printed.
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

import pg from "pg";

const MIGRATIONS_DIR = path.join(process.cwd(), "prisma", "migrations");
const DESTRUCTIVE = /\b(DROP\s+(TABLE|COLUMN|SCHEMA|DATABASE|TYPE)|TRUNCATE|DELETE\s+FROM|ALTER\s+TABLE[^;]*\bDROP\s+(?!NOT\s+NULL|DEFAULT|CONSTRAINT|INDEX))/i;

function localMigrations() {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(path.join(MIGRATIONS_DIR, d.name, "migration.sql")))
    .map((d) => d.name)
    .sort();
}

async function migrationState(url) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const exists = await client.query(`SELECT to_regclass('public._prisma_migrations') AS t`);
    if (!exists.rows[0].t) return { applied: new Set(), failed: [] };
    const res = await client.query(
      `SELECT migration_name, finished_at, rolled_back_at, started_at FROM "_prisma_migrations" ORDER BY started_at`,
    );
    return {
      applied: new Set(res.rows.filter((r) => r.finished_at && !r.rolled_back_at).map((r) => r.migration_name)),
      // Started but never finished and not rolled back: Prisma will refuse to run anything until it is resolved.
      failed: res.rows.filter((r) => !r.finished_at && !r.rolled_back_at).map((r) => r.migration_name),
    };
  } finally {
    await client.end();
  }
}

function explainFailedMigrations(failed) {
  console.error(`[migrate] The database has ${failed.length} migration(s) recorded as FAILED:\n  - ${failed.join("\n  - ")}`);
  console.error(
    [
      "[migrate] Prisma refuses to apply anything (error P3009) until each one is resolved, so every deploy fails until then.",
      "[migrate] A failed migration is usually one that stopped part-way (e.g. 'column already exists'). Postgres runs each",
      "[migrate] migration file as one transaction, so a failed file changed nothing. From your own machine, with this",
      "[migrate] database's DIRECT (non-pooled) URL in DATABASE_URL, run — never `migrate reset`:",
      ...failed.map((name) => `[migrate]     npx prisma migrate resolve --rolled-back ${name}`),
      "[migrate] Then redeploy. If you are sure the migration's changes are already fully present, use --applied instead.",
    ].join("\n"),
  );
}

/** Strips SQL comments so a commented-out DROP doesn't count. */
function destructiveStatements(sql) {
  const stripped = sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  return stripped
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s && DESTRUCTIVE.test(s))
    .map((s) => s.replace(/\s+/g, " ").slice(0, 160));
}

async function deploy(url) {
  try {
    execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
  } catch {
    console.error("[migrate] `prisma migrate deploy` failed — the Prisma error is printed just above (P3009 / P3018 / P1002 …).");
    try {
      const { failed } = await migrationState(url);
      if (failed.length > 0) explainFailedMigrations(failed);
    } catch {
      // The state check is only a diagnostic; the build already fails below.
    }
    process.exit(1);
  }
}

const env = process.env.VERCEL_ENV;

if (env !== "production" && env !== "preview") {
  console.log(`[migrate] Skipping migrate deploy (VERCEL_ENV=${env ?? "unset"}).`);
  process.exit(0);
}

// Migrations need a direct (non-pooled) connection: PgBouncer-style poolers
// break the advisory lock `migrate deploy` takes. Vercel's Neon integration
// provides DATABASE_URL_UNPOOLED; DIRECT_URL is the common manual name.
const migrationUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!migrationUrl) {
  console.error(`[migrate] DATABASE_URL is not set for the ${env} environment — cannot verify the schema. Failing the build.`);
  process.exit(1);
}

const { applied, failed } = await migrationState(migrationUrl);
if (failed.length > 0) {
  explainFailedMigrations(failed);
  process.exit(1);
}
const pending = localMigrations().filter((name) => !applied.has(name));

if (pending.length === 0) {
  console.log(`[migrate] ${env}: database schema is up to date (${applied.size} migrations applied).`);
  process.exit(0);
}

console.log(`[migrate] ${env}: ${pending.length} pending migration(s):\n  - ${pending.join("\n  - ")}`);

if (env === "preview" && process.env.PREVIEW_AUTO_MIGRATE !== "1") {
  console.warn(
    "[migrate] Preview build: NOT applying these migrations (they could fail against a database production also uses, and a failed\n" +
      "[migrate] migration blocks every later deploy). The preview's pages that need them will error until the database is migrated.\n" +
      "[migrate] Give previews their own database and set PREVIEW_AUTO_MIGRATE=1 on the preview environment to apply them automatically.",
  );
  process.exit(0);
}

if (env === "preview") {
  const blocked = pending
    .map((name) => ({ name, statements: destructiveStatements(readFileSync(path.join(MIGRATIONS_DIR, name, "migration.sql"), "utf8")) }))
    .filter((m) => m.statements.length > 0);
  if (blocked.length > 0) {
    console.error("[migrate] Preview builds only apply additive migrations. These contain destructive statements:");
    for (const m of blocked) console.error(`  ${m.name}:\n    ${m.statements.join("\n    ")}`);
    console.error("[migrate] Review them and apply deliberately with `npx prisma migrate deploy`, then redeploy.");
    process.exit(1);
  }
}

await deploy(migrationUrl);
