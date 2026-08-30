# Manpower HRIS

A workforce/payroll/client-billing ERP for a Saudi manpower supply company, replacing an Excel-based workflow. Built with Next.js (App Router), TypeScript, PostgreSQL, and Prisma.

This is a multi-phase build. **Phase 1** shipped foundation UI: auth/RBAC, Worker Master, Client → Project → Site hierarchy, and the Assignment system. **Phase 2** established the full database architecture for the entire system (timesheets, payroll, leave, internal employees, finance, billing, coordinator commissions, configuration), a centralized calculation engine, and a reusable Excel import pipeline — UI for those modules lands in later phases.

## Local setup

1. Start Postgres (Docker Desktop must be running first):
   ```bash
   docker compose up -d
   ```
   This runs Postgres on **port 5433** (not 5432 — a native PostgreSQL service already owns 5432 on this machine).

2. Copy the env file and generate a secret:
   ```bash
   cp .env.example .env
   # replace AUTH_SECRET's placeholder value
   ```

3. Install dependencies, apply the schema, and seed data (imports the real rows from `reference/DEMO IN.xlsx`):
   ```bash
   npm install
   npm run db:migrate
   npm run db:seed
   ```

4. Start the dev server:
   ```bash
   npm run dev
   ```

5. Log in at [http://localhost:3000](http://localhost:3000) with the seeded admin account:
   - Email: `admin@hris.local`
   - Password: `ChangeMe123!` (change this after first login — there's no self-service password change yet; update it directly via `prisma studio` or a DB client for now)

## Scripts

- `npm run dev` — start the dev server
- `npm run db:migrate` — apply Prisma migrations (`prisma migrate dev`)
- `npm run db:seed` — re-run the seed script (idempotent — skips workers that already exist by Iqama number)
- `npm run db:studio` — open Prisma Studio to browse the database
- `npm run lint` / `npx tsc --noEmit` — lint / typecheck
- `npm test` — run the test suite once (`npm run test:watch` to watch). Requires Postgres running (`docker compose up -d`) — the integration tests in `src/server/__tests__/integration/` exercise real database constraints and clean up after themselves.

## Architecture notes

- **RBAC is enforced server-side** in every server action and query via `src/server/rbac.ts`'s `can()`/`assertCan()` — never only in the UI. Deliberately a reviewable code matrix (`Role -> Resource -> Action`) rather than dynamic DB-driven permission tables — see the comment on the `User` model in `prisma/schema.prisma` for why.
- **Every mutation writes an audit log entry** (`src/server/audit.ts`), viewable at `/audit-log`.
- **Historical assignments are never overwritten** — starting a new assignment for a worker ends their previous one (sets `endDate`/`status: ENDED`) inside a transaction; the old row stays intact.
- **Money uses `decimal.js`/Prisma `Decimal`**, never floating point. Every salary/billing/commission formula goes through the centralized calculation engine in `src/server/calc/` (`calculateWorkerPayroll`, `calculateClientBilling`, `calculateCommission`, `calculateOutstanding`, etc.) rather than being reimplemented inline — these are pure, unit-tested functions with no DB dependency.
- **Excel imports go through a shared pipeline** (`src/server/import/`): extract rows → validate (with a downloadable-shape error report) → commit. The worker migration from `DEMO IN.xlsx` and the seed script both use it; a future timesheet-upload UI can reuse it directly.
- **Payroll/billing rates are snapshotted, never re-derived.** `WorkerPayroll`/`Assignment` rows store the rate that applied at the time, so a later rate change never recalculates historical pay.
- **Calculation rules live in data, not code** — `/settings` edits the `OvertimeRule` and `BillingRule` the calculation engine reads, and `SystemSetting` holds the configurable currency code.
- Production is intended to run on Vercel with a managed Postgres provider (Neon/Supabase) — swap `DATABASE_URL` in the environment, no schema changes needed.
