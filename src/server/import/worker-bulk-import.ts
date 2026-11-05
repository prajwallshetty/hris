import { cleanString, findColumnIndex, normalizeName, parseExcelDate, readWorksheetRows } from "./excel-utils";
import { pickCoordinator, type CoordinatorSource } from "@/lib/coordinator-resolution";
import { IQAMA_PATTERN, WORKER_TYPES, type ManpowerRegistrationInput, type WorkerTypeValue } from "@/lib/validation/manpower";

// Manpower Bulk Import (Workers → Bulk Import → Download Template → fill →
// upload → preview → import). This column list is the single source of
// truth: header detection, validation and the downloadable template are all
// generated from it, so the template can never drift from what the importer
// actually accepts. Columns are matched by header text, not position.
//
// Distinct from prisma/seed.ts's worker-import.ts, which replays one fixed
// legacy reference workbook — the two formats are not interchangeable.
export const WORKER_IMPORT_COLUMNS = [
  { key: "fullName", header: "Full Name", aliases: ["NAME", "WORKER NAME"], required: true, example: "Mohammed Ahmed", note: "Worker's full name." },
  { key: "nationality", header: "Nationality", aliases: [], required: true, example: "India", note: "Country of nationality." },
  { key: "mobile", header: "Mobile", aliases: ["MOBILE NUMBER", "PHONE"], required: true, example: "0501234567", note: "Any format. Format this column as Text in Excel to keep a leading zero." },
  { key: "mobilization", header: "Mobilization", aliases: ["MOBILIZATION DATE", "MOBILISATION", "MOBILISATION DATE", "MOB"], required: true, example: "01/10/2026", note: "Mobilization date as DD/MM/YYYY or YYYY-MM-DD." },
  { key: "workerType", header: "Worker Type", aliases: ["TYPE"], required: true, example: "FRL", note: "FRL (freelance), HRD (supplier-provided) or OWN (company-owned)." },
  { key: "iqama", header: "Iqama Number", aliases: ["IQAMA", "IQAMA NO", "IQAMA NO."], required: false, example: "", note: "10 digits, if available. Must be unique — a row whose Iqama is already registered is reported, never imported over the existing worker." },
  { key: "craft", header: "Craft / Trade", aliases: ["CRAFT", "TRADE", "SKILL CATEGORY"], required: false, example: "Skilled", note: "Trade category, e.g. Skilled, Semi-skilled." },
  { key: "designation", header: "Designation", aliases: ["JOB TITLE"], required: false, example: "Scaffolder", note: "Job title." },
  { key: "supplier", header: "Supplier", aliases: [], required: false, example: "", note: "Required for HRD rows; leave blank for FRL and OWN. Must exactly match an existing active supplier — unknown suppliers are never created automatically." },
  { key: "client", header: "Client", aliases: [], required: false, example: "", note: "Existing client name. Client, Project, Site, Worker Rate and Client Billing Rate go together — fill all five to place the worker, or leave all blank." },
  { key: "project", header: "Project", aliases: [], required: false, example: "", note: "Existing project under that client." },
  { key: "site", header: "Site", aliases: [], required: false, example: "", note: "Existing site under that project. Spacing and capital letters don't matter." },
  { key: "coordinator", header: "Coordinator", aliases: [], required: false, example: "", note: "Optional. Leave blank to use the project's coordinator (or the client's, if the project has none). Fill it only to override with a specific active coordinator." },
  { key: "workerRate", header: "Worker Rate", aliases: ["HOURLY RATE", "RATE"], required: false, example: "15", note: "What the worker is paid per hour (SAR)." },
  { key: "clientBillingRate", header: "Client Billing Rate", aliases: ["BILLING RATE", "CLIENT RATE"], required: false, example: "", note: "What the client is billed per hour (SAR). Needed only with a placement." },
  { key: "batchNumber", header: "Batch Number", aliases: ["BATCH NO", "BATCH"], required: false, example: "", note: "Optional grouping label, e.g. BATCH-001." },
  { key: "remarks", header: "Remarks", aliases: ["NOTES"], required: false, example: "", note: "Any free-text note." },
] as const;

type ColumnKey = (typeof WORKER_IMPORT_COLUMNS)[number]["key"];
export type WorkerBulkColumnMap = Record<ColumnKey, number>;

const HEADER_ROW_INDEX = 0;
const DATA_START_ROW_INDEX = 1;

function readRows(buffer: Buffer, start: number) {
  return readWorksheetRows(buffer, start, { rawText: true });
}

export function detectWorkerBulkColumns(buffer: Buffer): { columns: WorkerBulkColumnMap; missing: string[] } {
  const headerRow = readRows(buffer, HEADER_ROW_INDEX)[0] ?? [];
  const columns = {} as WorkerBulkColumnMap;
  const missing: string[] = [];
  for (const col of WORKER_IMPORT_COLUMNS) {
    const index = findColumnIndex(headerRow, [col.header, ...col.aliases]);
    columns[col.key] = index;
    if (index === -1 && col.required) missing.push(col.header);
  }
  return { columns, missing };
}

export type RawWorkerBulkRow = { rowNumber: number } & Record<ColumnKey, string | null>;

export function extractWorkerBulkRows(buffer: Buffer, columns: WorkerBulkColumnMap): RawWorkerBulkRow[] {
  const rows: RawWorkerBulkRow[] = [];
  readRows(buffer, DATA_START_ROW_INDEX).forEach((cells, index) => {
    const row = { rowNumber: DATA_START_ROW_INDEX + index + 1 } as RawWorkerBulkRow;
    for (const col of WORKER_IMPORT_COLUMNS) {
      const i = columns[col.key];
      row[col.key] = i >= 0 ? cleanString(cells[i]) : null;
    }
    // A blank separator row carries no data at all — skip it rather than
    // reporting five "missing" errors for it.
    if (WORKER_IMPORT_COLUMNS.every((col) => row[col.key] === null)) return;
    rows.push(row);
  });
  return rows;
}

type NamedRef = { id: string; name: string };

/** Everything validation needs from the database, pre-loaded by the caller. */
export type WorkerBulkImportContext = {
  existingByIqama: ReadonlyMap<string, { fullName: string }>;
  /** `${lowercase name}|${mobile}|${yyyy-mm-dd}` of existing workers, for Iqama-less duplicate detection. */
  existingNaturalKeys: ReadonlySet<string>;
  /** Active suppliers. */
  suppliers: readonly NamedRef[];
  clients: readonly (NamedRef & { coordinatorId: string | null })[];
  /** Non-archived projects of the clients that could match. */
  projects: readonly (NamedRef & { clientId: string; coordinatorId: string | null })[];
  /** Non-archived sites of the projects that could match. */
  sites: readonly (NamedRef & { projectId: string })[];
  /** ACTIVE coordinators only — an inactive one is never assigned. */
  coordinators: readonly NamedRef[];
};

/** Names indexed by their normalized form (spacing and case folded), so matching ignores both. */
function indexByName<T extends NamedRef>(items: readonly T[], keyOf: (item: T) => string = () => ""): Map<string, T[]> {
  const index = new Map<string, T[]>();
  for (const item of items) {
    const key = `${keyOf(item)}|${normalizeName(item.name)}`;
    const list = index.get(key);
    if (list) list.push(item);
    else index.set(key, [item]);
  }
  return index;
}

export function naturalKey(fullName: string, mobile: string, mobilizationIso: string) {
  return `${fullName.trim().toLowerCase()}|${mobile.trim()}|${mobilizationIso}`;
}

/** A row that passed validation, already in the exact shape Quick Register saves. */
export type ValidWorkerBulkRow = {
  rowNumber: number;
  valid: true;
  data: ManpowerRegistrationInput;
  batchNumber: string | null;
  /** The row as uploaded, kept so a row that fails at save time can still be exported for correction. */
  source: Record<string, string | null>;
  display: {
    supplier: string | null;
    client: string | null;
    project: string | null;
    site: string | null;
    coordinator: string | null;
    coordinatorSource: CoordinatorSource;
  };
};

export type InvalidWorkerBulkRow = {
  rowNumber: number;
  valid: false;
  fullName: string | null;
  iqamaNumber: string | null;
  errors: string[];
  /** The row exactly as uploaded, so a rejected record can be corrected and re-uploaded. */
  source: Record<string, string | null>;
};

export type WorkerBulkRowResult = ValidWorkerBulkRow | InvalidWorkerBulkRow;

function parseRate(raw: string | null, label: string, errors: string[]): number | null {
  if (raw === null) return null;
  const value = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(value) || value < 0) {
    errors.push(`${label} must be a number of 0 or more (got "${raw}").`);
    return null;
  }
  return value;
}

/** Exactly one match by name, or a human-readable reason there isn't one. */
function resolveOne<T extends NamedRef>(
  matches: T[] | undefined,
  label: string,
  name: string,
  errors: string[],
  hints: { available?: readonly string[]; elsewhere?: string | null } = {},
): T | null {
  if (!matches || matches.length === 0) {
    const available = (hints.available ?? []).slice(0, 6);
    const more = (hints.available?.length ?? 0) > available.length ? ", …" : "";
    errors.push(
      `${label} "${name}" was not found.` +
        (hints.elsewhere ? ` ${hints.elsewhere}` : "") +
        (available.length ? ` Available: ${available.join(", ")}${more}.` : ""),
    );
    return null;
  }
  if (matches.length > 1) {
    errors.push(`${label} "${name}" matches more than one record — rename one so it is unique.`);
    return null;
  }
  return matches[0];
}

/** The row as uploaded, except a recognisable mobilization date is shown (and re-exported) as YYYY-MM-DD rather than a bare Excel serial. */
function sourceOf(row: RawWorkerBulkRow): Record<string, string | null> {
  const converted = row.mobilization ? parseExcelDate(row.mobilization) : null;
  return Object.fromEntries(
    WORKER_IMPORT_COLUMNS.map((c) => [c.header, c.key === "mobilization" && converted ? converted.toISOString().slice(0, 10) : row[c.key]]),
  );
}

/**
 * Validates every row without touching the database. Never resolves an
 * ambiguous or unknown supplier/client/project/site by guessing, and never
 * lets a row with an already-registered Iqama through.
 */
export function validateWorkerBulkRows(rows: RawWorkerBulkRow[], ctx: WorkerBulkImportContext): WorkerBulkRowResult[] {
  const seenIqamas = new Set<string>();
  const seenNaturalKeys = new Set<string>();

  const suppliers = indexByName(ctx.suppliers);
  const clients = indexByName(ctx.clients);
  const projects = indexByName(ctx.projects, (p) => p.clientId);
  const projectsByAnyClient = indexByName(ctx.projects);
  const sites = indexByName(ctx.sites, (st) => st.projectId);
  const sitesByAnyProject = indexByName(ctx.sites);
  const coordinators = indexByName(ctx.coordinators);
  const coordinatorById = new Map(ctx.coordinators.map((c) => [c.id, c]));
  const clientName = new Map(ctx.clients.map((c) => [c.id, c.name]));
  const projectName = new Map(ctx.projects.map((p) => [p.id, p.name]));

  return rows.map((row) => {
    const errors: string[] = [];
    const invalid = (): InvalidWorkerBulkRow => ({
      rowNumber: row.rowNumber,
      valid: false,
      fullName: row.fullName,
      iqamaNumber: row.iqama,
      errors,
      source: sourceOf(row),
    });

    if (!row.fullName) errors.push("Full Name is required.");
    if (!row.nationality) errors.push("Nationality is required.");
    if (!row.mobile) errors.push("Mobile is required.");

    let mobilizationIso: string | null = null;
    if (!row.mobilization) {
      errors.push("Mobilization date is required.");
    } else {
      const date = parseExcelDate(row.mobilization);
      if (date) mobilizationIso = date.toISOString().slice(0, 10);
      else errors.push(`Mobilization date "${row.mobilization}" is not a valid date — use DD/MM/YYYY or YYYY-MM-DD.`);
    }

    let workerType: WorkerTypeValue | null = null;
    if (!row.workerType) {
      errors.push("Worker Type is required (FRL, HRD or OWN).");
    } else {
      const normalized = row.workerType.trim().toUpperCase();
      if ((WORKER_TYPES as readonly string[]).includes(normalized)) workerType = normalized as WorkerTypeValue;
      else errors.push(`Worker Type "${row.workerType}" is not recognised — use FRL, HRD or OWN.`);
    }

    // Iqama: optional, but 10 digits and unique when present.
    const iqama = row.iqama?.replace(/\s+/g, "") || null;
    if (iqama) {
      if (!IQAMA_PATTERN.test(iqama)) {
        errors.push(`Iqama "${row.iqama}" must be exactly 10 digits.`);
      } else if (seenIqamas.has(iqama)) {
        errors.push(`Iqama ${iqama} appears more than once in this file.`);
      } else {
        seenIqamas.add(iqama);
        const existing = ctx.existingByIqama.get(iqama);
        if (existing) errors.push(`Iqama ${iqama} is already registered to ${existing.fullName}.`);
      }
    } else if (row.fullName && row.mobile && mobilizationIso) {
      const key = naturalKey(row.fullName, row.mobile, mobilizationIso);
      if (seenNaturalKeys.has(key)) errors.push("This worker (same name, mobile and mobilization date) appears more than once in this file.");
      else if (ctx.existingNaturalKeys.has(key)) errors.push("This worker (same name, mobile and mobilization date) is already registered.");
      seenNaturalKeys.add(key);
    }

    // Supplier: required for HRD, and only meaningful for HRD.
    let supplier: NamedRef | null = null;
    if (workerType === "HRD") {
      if (!row.supplier) errors.push("Supplier is required for HRD manpower.");
      else supplier = resolveOne(suppliers.get(`|${normalizeName(row.supplier)}`), "Supplier", row.supplier, errors);
    } else if (workerType && row.supplier) {
      errors.push(`Supplier is only used for HRD manpower — remove it or change Worker Type to HRD.`);
    }

    const workerRate = parseRate(row.workerRate, "Worker Rate", errors);
    const clientBillingRate = parseRate(row.clientBillingRate, "Client Billing Rate", errors);

    // Placement is all-or-nothing, same rule as Quick Register.
    let client: NamedRef | null = null;
    let project: NamedRef | null = null;
    let site: NamedRef | null = null;
    const placementStarted = Boolean(row.client || row.project || row.site || row.clientBillingRate);
    if (placementStarted) {
      if (!row.client || !row.project || !row.site) {
        errors.push("To place a worker, fill Client, Project and Site together (or leave all three blank).");
      } else {
        client = resolveOne(clients.get(`|${normalizeName(row.client)}`), "Client", row.client, errors, {
          available: ctx.clients.map((c) => c.name),
        });
        if (client) {
          const ownProjects = ctx.projects.filter((p) => p.clientId === client!.id).map((p) => p.name);
          const elsewhere = (projectsByAnyClient.get(`|${normalizeName(row.project)}`) ?? []).filter((p) => p.clientId !== client!.id);
          project = resolveOne(projects.get(`${client.id}|${normalizeName(row.project)}`), `Project under ${client.name}`, row.project, errors, {
            available: ownProjects,
            elsewhere: elsewhere.length
              ? `A project with that name exists under ${elsewhere.map((p) => clientName.get(p.clientId)).join(", ")} — check the Client column.`
              : null,
          });
        }
        if (project) {
          const ownSites = ctx.sites.filter((st) => st.projectId === project!.id).map((st) => st.name);
          const elsewhere = (sitesByAnyProject.get(`|${normalizeName(row.site)}`) ?? []).filter((st) => st.projectId !== project!.id);
          site = resolveOne(sites.get(`${project.id}|${normalizeName(row.site)}`), `Site under ${project.name}`, row.site, errors, {
            available: ownSites,
            elsewhere: elsewhere.length
              ? `A site with that name exists under project ${elsewhere.map((st) => projectName.get(st.projectId)).join(", ")} — check the Project column.`
              : null,
          });
        }
      }
      if (row.workerRate === null) errors.push("Worker Rate is required when placing a worker at a site.");
      if (row.clientBillingRate === null) errors.push("Client Billing Rate is required when placing a worker at a site.");
    }

    // Coordinator: an explicit column value is kept (it must be an active
    // coordinator); otherwise Project → Client, never a guess. Only a placed
    // worker has a project/client to resolve from.
    let manualCoordinator: NamedRef | null = null;
    if (row.coordinator) {
      manualCoordinator = resolveOne(coordinators.get(`|${normalizeName(row.coordinator)}`), "Coordinator", row.coordinator, errors, {
        available: ctx.coordinators.map((c) => c.name),
      });
    }
    const projectCoordinator = project?.id ? coordinatorById.get(ctx.projects.find((p) => p.id === project!.id)?.coordinatorId ?? "") : undefined;
    const clientCoordinator = client?.id ? coordinatorById.get(ctx.clients.find((c) => c.id === client!.id)?.coordinatorId ?? "") : undefined;
    const pickedCoordinator = pickCoordinator({
      manualId: manualCoordinator?.id,
      projectCoordinatorId: projectCoordinator?.id,
      clientCoordinatorId: clientCoordinator?.id,
    });
    const coordinatorName = manualCoordinator?.name ?? (pickedCoordinator.source === "project" ? projectCoordinator?.name : pickedCoordinator.source === "client" ? clientCoordinator?.name : null) ?? null;

    if (errors.length > 0 || !row.fullName || !row.nationality || !row.mobile || !mobilizationIso || !workerType) {
      return invalid();
    }

    return {
      rowNumber: row.rowNumber,
      valid: true,
      data: {
        fullName: row.fullName,
        nationality: row.nationality,
        mobile: row.mobile,
        mobilizationDate: mobilizationIso,
        workerType,
        supplierId: supplier?.id ?? "",
        iqamaNumber: iqama ?? "",
        designation: row.designation ?? "",
        skillCategory: row.craft ?? "",
        clientId: client?.id ?? "",
        projectId: project?.id ?? "",
        siteId: site?.id ?? "",
        // Only an explicit Coordinator column value is stored in the row; the
        // automatic one is re-resolved when the row is saved, so it can never
        // go stale between preview and import.
        coordinatorId: manualCoordinator?.id ?? "",
        workerRate,
        clientBillingRate,
        notes: row.remarks ?? "",
      },
      batchNumber: row.batchNumber,
      source: sourceOf(row),
      display: {
        supplier: supplier?.name ?? null,
        client: client?.name ?? null,
        project: project?.name ?? null,
        site: site?.name ?? null,
        coordinator: coordinatorName,
        coordinatorSource: pickedCoordinator.source,
      },
    };
  });
}

export type WorkerBulkImportSummary = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errorReport: {
    rowNumber: number;
    fullName: string | null;
    iqamaNumber: string | null;
    errors: string[];
    /** The row as uploaded (template header → value), for the "download rejected rows" file. */
    source?: Record<string, string | null>;
  }[];
};

export function summarizeWorkerBulkImport(results: WorkerBulkRowResult[]): WorkerBulkImportSummary {
  const invalid = results.filter((r): r is InvalidWorkerBulkRow => !r.valid);
  return {
    totalRows: results.length,
    validRows: results.length - invalid.length,
    invalidRows: invalid.length,
    errorReport: invalid.map((r) => ({
      rowNumber: r.rowNumber,
      fullName: r.fullName,
      iqamaNumber: r.iqamaNumber,
      errors: r.errors,
      source: r.source,
    })),
  };
}
