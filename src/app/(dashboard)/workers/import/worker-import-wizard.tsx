"use client";

import { AlertTriangle, ArrowRight, CheckCircle2, CopyX, Download, Loader2, Upload, XCircle } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { WorkerBulkImportSummary, WorkerBulkPreviewRow } from "@/server/import/worker-bulk-import";
import { importWorkerRows, previewWorkerImport, type WorkerImportPreview } from "@/server/actions/workers";

function downloadCsv(filename: string, lines: string[][]) {
  const csv = lines.map((line) => line.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
  // BOM so Excel opens Arabic / accented names correctly.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadErrorReport(rows: WorkerBulkImportSummary["errorReport"]) {
  downloadCsv("manpower-import-errors.csv", [
    ["Row", "Full Name", "Iqama", "Issue"],
    ...rows.map((r) => [String(r.rowNumber), r.fullName ?? "", r.iqamaNumber ?? "", r.errors.join(" ")]),
  ]);
}

/** The rejected rows as uploaded, in the template's own columns — fix them and upload this file again. */
function downloadRejectedRows(rows: WorkerBulkImportSummary["errorReport"]) {
  const withSource = rows.filter((r) => r.source);
  if (withSource.length === 0) return;
  const headers = Object.keys(withSource[0].source!);
  downloadCsv("manpower-import-rejected-rows.csv", [
    [...headers, "Why it was rejected"],
    ...withSource.map((r) => [...headers.map((h) => r.source![h] ?? ""), r.errors.join(" ")]),
  ]);
}

type ImportOutcome = {
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  errorReport: WorkerBulkImportSummary["errorReport"];
};

const STATUS_STYLE: Record<WorkerBulkPreviewRow["status"], { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  ready: { label: "Ready", className: "border-emerald-200 bg-emerald-50 text-emerald-700", Icon: CheckCircle2 },
  duplicate: { label: "Duplicate", className: "border-amber-200 bg-amber-50 text-amber-800", Icon: CopyX },
  error: { label: "Error", className: "border-red-200 bg-red-50 text-red-700", Icon: XCircle },
};

function StatusBadge({ status }: { status: WorkerBulkPreviewRow["status"] }) {
  const { label, className, Icon } = STATUS_STYLE[status];
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-md border px-2 text-xs font-semibold whitespace-nowrap", className)}>
      <Icon className="size-3.5" />
      {label}
    </span>
  );
}

const SOURCE_LABEL = { manual: "From the file", project: "From the project", client: "From the client", none: "" } as const;

type Filter = "all" | WorkerBulkPreviewRow["status"];

function PreviewTable({
  rows,
  canUpdate,
  selectedUpdates,
  onToggleUpdate,
}: {
  rows: WorkerBulkPreviewRow[];
  canUpdate: boolean;
  selectedUpdates: ReadonlySet<number>;
  onToggleUpdate: (rowNumber: number) => void;
}) {
  return (
    <div className="max-h-[32rem] overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14">Row</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Worker Name</TableHead>
            <TableHead>Iqama</TableHead>
            <TableHead>Mobilization</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Site</TableHead>
            <TableHead>Coordinator</TableHead>
            <TableHead className="min-w-80">Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.rowNumber} className={cn(r.status === "error" && "bg-red-50/30", r.status === "duplicate" && "bg-amber-50/40")}>
              <TableCell className="tabular-nums">{r.rowNumber}</TableCell>
              <TableCell>
                <StatusBadge status={r.status} />
              </TableCell>
              <TableCell className="font-medium">{r.fullName ?? "—"}</TableCell>
              <TableCell className="font-mono text-xs">{r.iqamaNumber ?? "—"}</TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">{r.mobilizationDate ?? "—"}</TableCell>
              <TableCell className="font-mono text-xs font-semibold">{r.workerType ?? "—"}</TableCell>
              <TableCell>{r.supplier ?? "—"}</TableCell>
              <TableCell>{r.client ?? <span className="text-muted-foreground">{r.status === "ready" ? "Not placed" : "—"}</span>}</TableCell>
              <TableCell>{r.project ?? "—"}</TableCell>
              <TableCell>{r.site ?? "—"}</TableCell>
              <TableCell className="min-w-40">
                {r.coordinator ? (
                  <>
                    {r.coordinator}
                    {r.coordinatorSource && SOURCE_LABEL[r.coordinatorSource] && (
                      <span className="text-muted-foreground block text-[11px]">{SOURCE_LABEL[r.coordinatorSource]}</span>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground">{r.status === "ready" && r.site ? "Unassigned" : "—"}</span>
                )}
              </TableCell>
              <TableCell className="min-w-80 whitespace-normal">
                {r.status === "ready" && <span className="text-muted-foreground text-xs">Will be created as a new worker.</span>}

                {r.issues.length > 0 && (
                  <ul className={cn("list-disc space-y-0.5 pl-4 text-xs", r.status === "error" ? "text-red-700" : "text-amber-800")}>
                    {r.issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                )}

                {r.status === "duplicate" && (
                  <div className="mt-1.5 space-y-1.5 text-xs">
                    <p className="font-medium text-slate-700">Not imported as a new worker — the existing worker is left untouched.</p>
                    {r.updatable && r.changes ? (
                      <div className="rounded-md border border-slate-200 bg-white p-2">
                        <p className="mb-1 font-semibold text-slate-800">If you update the existing worker, this changes:</p>
                        <ul className="space-y-0.5">
                          {r.changes.map((c) => (
                            <li key={c.field} className="flex flex-wrap items-center gap-1">
                              <span className="text-slate-500">{c.label}:</span>
                              <span className="text-slate-500 line-through">{c.from}</span>
                              <ArrowRight className="size-3 text-slate-400" />
                              <span className="font-semibold text-slate-900">{c.to}</span>
                            </li>
                          ))}
                        </ul>
                        {canUpdate && (
                          <label className="mt-2 flex cursor-pointer items-center gap-2 font-medium">
                            <input
                              type="checkbox"
                              className="size-4 accent-[var(--primary)]"
                              checked={selectedUpdates.has(r.rowNumber)}
                              onChange={() => onToggleUpdate(r.rowNumber)}
                            />
                            Update {r.existing?.fullName} with these values
                          </label>
                        )}
                      </div>
                    ) : (
                      <p className="text-slate-500">
                        {r.changes && r.changes.length === 0
                          ? "The file has no differences from the existing worker — nothing to update."
                          : "Fix the other issues on this row to be able to update the existing worker."}
                      </p>
                    )}
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function WorkerImportWizard() {
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [preview, setPreview] = useState<WorkerImportPreview | null>(null);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedUpdates, setSelectedUpdates] = useState<ReadonlySet<number>>(new Set());

  function reset() {
    setFile(null);
    setPreview(null);
    setOutcome(null);
    setSelectedUpdates(new Set());
    setFilter("all");
    setFileInputKey((k) => k + 1);
  }

  function toggleUpdate(rowNumber: number) {
    setSelectedUpdates((current) => {
      const next = new Set(current);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  }

  async function handlePreview() {
    if (!file) {
      toast.error("Please choose a file to upload.");
      return;
    }
    setIsPreviewing(true);
    setPreview(null);
    setSelectedUpdates(new Set());
    setFilter("all");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await previewWorkerImport(formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setPreview(result.data);
      if (result.data.summary.validRows === 0) toast.error("No new workers found to import — see the details below.");
    } finally {
      setIsPreviewing(false);
    }
  }

  const updates = useMemo(
    () => (preview?.updateCandidates ?? []).filter((c) => selectedUpdates.has(c.rowNumber)),
    [preview, selectedUpdates],
  );

  async function handleImport() {
    if (!preview || !file || (preview.validRows.length === 0 && updates.length === 0)) return;
    setIsImporting(true);
    try {
      const result = await importWorkerRows({
        fileName: file.name,
        summary: preview.summary,
        items: preview.validRows,
        updates: updates.map((u) => ({ rowNumber: u.rowNumber, data: u.data })),
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      // Rows that failed at write time aren't in the preview's report; the
      // server's Import History record has the complete list, but show the
      // preview-time issues here so the user can fix and re-upload.
      setOutcome({ ...result.data, errorReport: preview.summary.errorReport });
      setPreview(null);
      toast.success(
        `${result.data.importedCount} worker(s) imported${result.data.updatedCount ? `, ${result.data.updatedCount} updated` : ""}.`,
      );
    } finally {
      setIsImporting(false);
    }
  }

  if (outcome) {
    const outstanding = outcome.errorReport.filter((e) => e.errors.length > 0);
    return (
      <div className="data-panel space-y-4 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="text-success mt-0.5 size-6 shrink-0" />
          <div>
            <p className="text-lg font-semibold">Import complete</p>
            <p className="text-muted-foreground text-sm">The full row-by-row record is kept in Import History.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-md border p-3">
            <p className="text-muted-foreground text-xs">New workers created</p>
            <p className="text-success text-2xl font-semibold tabular-nums">{outcome.importedCount}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-muted-foreground text-xs">Existing workers updated</p>
            <p className="text-2xl font-semibold tabular-nums">{outcome.updatedCount}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-muted-foreground text-xs">Skipped (duplicates left as they were)</p>
            <p className="text-2xl font-semibold text-amber-700 tabular-nums">{outcome.skippedCount}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-muted-foreground text-xs">Not imported (errors)</p>
            <p className="text-destructive text-2xl font-semibold tabular-nums">{outcome.failedCount}</p>
          </div>
        </div>
        {outstanding.length > 0 && (
          <div className="max-h-72 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Row</TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Iqama</TableHead>
                  <TableHead>Mobilization</TableHead>
                  <TableHead>Why it was not imported</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outstanding.map((e, index) => (
                  <TableRow key={`${e.rowNumber}-${index}`}>
                    <TableCell className="tabular-nums">{e.rowNumber}</TableCell>
                    <TableCell>{e.fullName ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{e.iqamaNumber ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{e.source?.["Mobilization"] ?? "—"}</TableCell>
                    <TableCell className="min-w-72 whitespace-normal text-red-700">
                      <ul className="list-disc space-y-0.5 pl-4">
                        {e.errors.map((message) => (
                          <li key={message}>{message}</li>
                        ))}
                      </ul>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button nativeButton={false} render={<Link href="/workers" />}>
            View Workers
          </Button>
          {outstanding.length > 0 && (
            <>
              <Button variant="outline" onClick={() => downloadErrorReport(outstanding)}>
                <Download className="size-4" />
                Download Error Report
              </Button>
              <Button variant="outline" onClick={() => downloadRejectedRows(outstanding)}>
                <Download className="size-4" />
                Download Rejected Rows to Fix
              </Button>
            </>
          )}
          <Button variant="outline" onClick={reset}>
            <Upload className="size-4" />
            Import Another File
          </Button>
          <Button variant="ghost" nativeButton={false} render={<Link href="/import-history" />}>
            Import History
          </Button>
        </div>
      </div>
    );
  }

  const visibleRows = preview ? (filter === "all" ? preview.rows : preview.rows.filter((r) => r.status === filter)) : [];
  const importCount = (preview?.validRows.length ?? 0) + updates.length;

  return (
    <div className="space-y-6">
      <div className="data-panel p-4">
        <Field>
          <FieldLabel htmlFor="file">Manpower file (.xlsx, .xls or .csv) *</FieldLabel>
          <Input
            key={fileInputKey}
            id="file"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPreview(null);
            }}
          />
          <p className="text-muted-foreground text-xs">
            Required columns: Full Name, Nationality, Mobile, Mobilization, Worker Type (FRL / HRD / OWN). HRD rows also
            need a Supplier. Everything else is optional — see the template&rsquo;s Instructions sheet.
          </p>
        </Field>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" nativeButton={false} render={<a href="/api/workers/import-template" />}>
              <Download className="size-4" />
              Excel Template
            </Button>
            <Button variant="outline" nativeButton={false} render={<a href="/api/workers/import-template?format=csv" />}>
              <Download className="size-4" />
              CSV Template
            </Button>
          </div>
          <Button onClick={handlePreview} disabled={isPreviewing || !file}>
            {isPreviewing && <Loader2 className="size-4 animate-spin" />}
            Preview Import
          </Button>
        </div>
      </div>

      {preview && (
        <div className="data-panel space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground mr-2">{preview.summary.totalRows} rows in file</span>
            {(
              [
                ["all", `All ${preview.summary.totalRows}`],
                ["ready", `${preview.summary.validRows} ready`],
                ["duplicate", `${preview.summary.duplicateRows} duplicate`],
                ["error", `${preview.summary.invalidRows} with errors`],
              ] as [Filter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                  filter === key ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                {label}
              </button>
            ))}
            {preview.summary.errorReport.length > 0 && (
              <span className="ml-auto flex gap-2">
                <Button variant="outline" size="sm" onClick={() => downloadErrorReport(preview.summary.errorReport)}>
                  <Download className="size-3.5" />
                  Error Report
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadRejectedRows(preview.summary.errorReport)}>
                  <Download className="size-3.5" />
                  Rejected Rows to Fix
                </Button>
              </span>
            )}
          </div>

          {preview.summary.duplicateRows > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>
                <strong>{preview.summary.duplicateRows}</strong> row{preview.summary.duplicateRows === 1 ? " uses" : "s use"} an Iqama that
                already belongs to a worker. {preview.summary.duplicateRows === 1 ? "It is" : "They are"} <strong>skipped</strong> — the existing worker is never overwritten.
                {preview.updateCandidates.length > 0
                  ? " Where the file differs, you can tick a row below to explicitly update that worker; the changes are shown first."
                  : ""}
              </p>
            </div>
          )}

          <PreviewTable
            rows={visibleRows}
            canUpdate={preview.updateCandidates.length > 0}
            selectedUpdates={selectedUpdates}
            onToggleUpdate={toggleUpdate}
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground text-xs">
              Read by build <span className="font-mono">{preview.engine.commit}</span> · SheetJS{" "}
              <span className="font-mono">{preview.engine.xlsx}</span> ({preview.engine.deployment})
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset} disabled={isImporting}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={isImporting || importCount === 0}>
                {isImporting && <Loader2 className="size-4 animate-spin" />}
                {preview.validRows.length > 0 && `Import ${preview.validRows.length} New Worker${preview.validRows.length === 1 ? "" : "s"}`}
                {preview.validRows.length > 0 && updates.length > 0 && " + "}
                {updates.length > 0 && `Update ${updates.length} Existing`}
                {importCount === 0 && "Nothing to import"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
