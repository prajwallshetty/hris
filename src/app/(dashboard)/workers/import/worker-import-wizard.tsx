"use client";

import { AlertTriangle, CheckCircle2, Download, Loader2, Upload } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { WorkerBulkImportSummary } from "@/server/import/worker-bulk-import";
import { importWorkerRows, previewWorkerImport, type WorkerImportPreview } from "@/server/actions/workers";

function downloadErrorReport(rows: WorkerBulkImportSummary["errorReport"]) {
  const lines = [
    ["Row", "Full Name", "Iqama", "Issue"],
    ...rows.map((r) => [String(r.rowNumber), r.fullName ?? "", r.iqamaNumber ?? "", r.errors.join(" ")]),
  ];
  const csv = lines.map((line) => line.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "manpower-import-errors.csv";
  a.click();
  URL.revokeObjectURL(url);
}

type ImportOutcome = {
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  errorReport: WorkerBulkImportSummary["errorReport"];
};

function ErrorTable({ rows }: { rows: WorkerBulkImportSummary["errorReport"] }) {
  return (
    <div className="max-h-72 overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Row</TableHead>
            <TableHead>Full Name</TableHead>
            <TableHead>Iqama</TableHead>
            <TableHead>Issue</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((e, index) => (
            <TableRow key={`${e.rowNumber}-${index}`}>
              <TableCell className="tabular-nums">{e.rowNumber}</TableCell>
              <TableCell>{e.fullName ?? "—"}</TableCell>
              <TableCell className="font-mono text-xs">{e.iqamaNumber ?? "—"}</TableCell>
              <TableCell className="text-destructive">{e.errors.join(" ")}</TableCell>
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

  function reset() {
    setFile(null);
    setPreview(null);
    setOutcome(null);
    setFileInputKey((k) => k + 1);
  }

  async function handlePreview() {
    if (!file) {
      toast.error("Please choose a file to upload.");
      return;
    }
    setIsPreviewing(true);
    setPreview(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await previewWorkerImport(formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setPreview(result.data);
      if (result.data.summary.validRows === 0) toast.error("No valid rows found — see the issues below.");
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleImport() {
    if (!preview || preview.validRows.length === 0 || !file) return;
    setIsImporting(true);
    try {
      const result = await importWorkerRows({ fileName: file.name, summary: preview.summary, items: preview.validRows });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      // Rows that failed at write time aren't in the preview's report; the
      // server's Import History record has the complete list, but show the
      // preview-time issues here so the user can fix and re-upload.
      setOutcome({ ...result.data, errorReport: preview.summary.errorReport });
      setPreview(null);
      toast.success(`${result.data.importedCount} worker(s) imported.`);
    } finally {
      setIsImporting(false);
    }
  }

  if (outcome) {
    return (
      <div className="space-y-4 rounded-lg border p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="text-success mt-0.5 size-6 shrink-0" />
          <div>
            <p className="text-lg font-semibold">Import complete</p>
            <p className="text-muted-foreground text-sm">The full row-by-row record is kept in Import History.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-md border p-3">
            <p className="text-muted-foreground text-xs">Created</p>
            <p className="text-success text-2xl font-semibold tabular-nums">{outcome.importedCount}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-muted-foreground text-xs">Skipped (already registered)</p>
            <p className="text-2xl font-semibold tabular-nums">{outcome.skippedCount}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-muted-foreground text-xs">Failed</p>
            <p className="text-destructive text-2xl font-semibold tabular-nums">{outcome.failedCount}</p>
          </div>
        </div>
        {outcome.errorReport.length > 0 && <ErrorTable rows={outcome.errorReport} />}
        <div className="flex flex-wrap gap-2">
          <Button nativeButton={false} render={<Link href="/workers" />}>
            View Workers
          </Button>
          {outcome.errorReport.length > 0 && (
            <Button variant="outline" onClick={() => downloadErrorReport(outcome.errorReport)}>
              <Download className="size-4" />
              Download Error Report
            </Button>
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

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4">
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
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="text-muted-foreground">{preview.summary.totalRows} rows in file</span>
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="text-success size-4" />
              {preview.summary.validRows} ready to import
            </span>
            {preview.summary.invalidRows > 0 && (
              <span className="text-destructive flex items-center gap-1.5 font-medium">
                <AlertTriangle className="size-4" />
                {preview.summary.invalidRows} with issues (will not be imported)
              </span>
            )}
            {preview.summary.errorReport.length > 0 && (
              <Button variant="outline" size="sm" className="ml-auto" onClick={() => downloadErrorReport(preview.summary.errorReport)}>
                <Download className="size-3.5" />
                Download Error Report
              </Button>
            )}
          </div>

          {preview.summary.errorReport.length > 0 && <ErrorTable rows={preview.summary.errorReport} />}

          {preview.validRows.length > 0 && (
            <div className="max-h-96 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Row</TableHead>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Nationality</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Mobilization</TableHead>
                    <TableHead>Iqama</TableHead>
                    <TableHead>Placement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.validRows.map((r) => (
                    <TableRow key={r.rowNumber}>
                      <TableCell className="tabular-nums">{r.rowNumber}</TableCell>
                      <TableCell className="font-medium">{r.data.fullName}</TableCell>
                      <TableCell className="font-mono text-xs font-semibold">{r.data.workerType}</TableCell>
                      <TableCell>{r.display.supplier ?? "—"}</TableCell>
                      <TableCell>{r.data.nationality}</TableCell>
                      <TableCell>{r.data.mobile}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.data.mobilizationDate}</TableCell>
                      <TableCell className="font-mono text-xs">{r.data.iqamaNumber || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.display.site ? `${r.display.client} / ${r.display.project} / ${r.display.site}` : "Not assigned"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={reset} disabled={isImporting}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={isImporting || preview.validRows.length === 0}>
              {isImporting && <Loader2 className="size-4 animate-spin" />}
              Import {preview.validRows.length} Valid Row{preview.validRows.length === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
