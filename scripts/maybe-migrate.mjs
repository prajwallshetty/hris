#!/usr/bin/env node
// Brings the deployment's database up to the schema this build's code
// expects, before `next build` runs. Wired into `npm run build` (the Build Command pinned in vercel.json).
//
// Why this runs on Preview too: a Preview deployment of a branch that adds
// a migration otherwise ships code that selects columns its database does
// not have yet (Prisma P2022/P2021). Almost every page then renders
// "Something went wrong" — that is exactly how `Worker.workerType` broke
// branch previews.
//
// Safety rules:
// - Local builds (VERCEL_ENV unset) never touch a database.
// - Production applies every pending migration, as before.
// - Preview applies pending migrations ONLY when every one of them is
//   additive. If any pending migration drops, truncates or deletes, the
//   build FAILS with the offending statements listed, so a branch can
//   never remove data from a database it shares with production. Apply
//   such a migration deliberately with `npx prisma migrate deploy`.
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

async function appliedMigrations(url) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const exists = await client.query(`SELECT to_regclass('public._prisma_migrations') AS t`);
    if (!exists.rows[0].t) return new Set();
    const res = await client.query(
      `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
    );
    return new Set(res.rows.map((r) => r.migration_name));
  } finally {
    await client.end();
  }
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

function deploy(url) {
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
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

const applied = await appliedMigrations(migrationUrl);
const pending = localMigrations().filter((name) => !applied.has(name));

if (pending.length === 0) {
  console.log(`[migrate] ${env}: database schema is up to date (${applied.size} migrations applied).`);
  process.exit(0);
}

console.log(`[migrate] ${env}: ${pending.length} pending migration(s):\n  - ${pending.join("\n  - ")}`);

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

deploy(migrationUrl);
