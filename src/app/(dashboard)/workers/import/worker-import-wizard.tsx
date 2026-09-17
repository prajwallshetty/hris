"use client";

import { AlertTriangle, CheckCircle2, Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { importWorkerRows, previewWorkerImport, type WorkerImportPreview } from "@/server/actions/workers";

function downloadErrorReport(rows: { rowNumber: number; iqamaNumber: string | null; errors: string[] }[]) {
  const lines = [
    ["Row", "Iqama", "Issue"],
    ...rows.map((r) => [String(r.rowNumber), r.iqamaNumber ?? "", r.errors.join(" ")]),
  ];
  const csv = lines.map((line) => line.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "worker-import-errors.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function WorkerImportWizard() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<WorkerImportPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  function reset() {
    setFile(null);
    setPreview(null);
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
      if (result.success) {
        setPreview(result.data);
        if (result.data.summary.validRows === 0) {
          toast.error("No valid rows found — see the errors below.");
        } else {
          toast.success(`${result.data.summary.validRows} of ${result.data.summary.totalRows} rows are ready to import.`);
        }
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleImport() {
    if (!preview || preview.validRows.length === 0 || !file) return;
    setIsImporting(true);
    try {
      const result = await importWorkerRows({
        fileName: file.name,
        summary: preview.summary,
        items: preview.validRows,
      });
      if (result.success) {
        toast.success(`${result.data.importedCount} worker(s) imported.`, {
          action: { label: "View Workers", onClick: () => router.push("/workers") },
        });
        reset();
        router.push("/workers");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="file">Worker File (.xlsx, .xls, .csv) *</FieldLabel>
            <Input
              id="file"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreview(null);
              }}
            />
            <p className="text-muted-foreground text-xs">
              Expected columns: Name, Iqama Number (required), Mobile, Designation, Worker Type, Joining Date, Status,
              Batch Number, Remarks (all optional).
            </p>
          </Field>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <Button
            variant="outline"
            render={
              <a href="/api/workers/import-template">
                <Download className="size-4" />
                Download Excel Template
              </a>
            }
          />
          <Button onClick={handlePreview} disabled={isPreviewing || !file}>
            {isPreviewing && <Loader2 className="size-4 animate-spin" />}
            Preview Import
          </Button>
        </div>
      </div>

      {preview && (
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="text-muted-foreground">{preview.summary.totalRows} total rows</span>
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="text-success size-4" />
              {preview.summary.validRows} valid
            </span>
            {preview.summary.invalidRows > 0 && (
              <span className="text-destructive flex items-center gap-1.5 font-medium">
                <AlertTriangle className="size-4" />
                {preview.summary.invalidRows} with errors
              </span>
            )}
            {preview.summary.errorReport.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="ml-auto"
                onClick={() => downloadErrorReport(preview.summary.errorReport)}
              >
                <Download className="size-3.5" />
                Download Error Report
              </Button>
            )}
          </div>

          {preview.summary.errorReport.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Iqama</TableHead>
                    <TableHead>Issue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.summary.errorReport.map((e) => (
                    <TableRow key={e.rowNumber}>
                      <TableCell>{e.rowNumber}</TableCell>
                      <TableCell>{e.iqamaNumber ?? "—"}</TableCell>
                      <TableCell className="text-destructive">{e.errors.join(" ")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {preview.validRows.length > 0 && (
            <div className="max-h-80 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Iqama</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Batch Number</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.validRows.map((r) => (
                    <TableRow key={r.rowNumber}>
                      <TableCell>{r.rowNumber}</TableCell>
                      <TableCell>{r.fullName}</TableCell>
                      <TableCell>{r.iqamaNumber}</TableCell>
                      <TableCell>{r.designation ?? "—"}</TableCell>
                      <TableCell>{r.status.replaceAll("_", " ")}</TableCell>
                      <TableCell>{r.batchNumber ?? "—"}</TableCell>
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
              Import Valid Rows ({preview.validRows.length})
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
