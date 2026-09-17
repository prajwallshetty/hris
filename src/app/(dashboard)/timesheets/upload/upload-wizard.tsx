"use client";

import { AlertTriangle, CheckCircle2, Download, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  importTimesheetRows,
  previewTimesheetImport,
  type TimesheetImportPreview,
} from "@/server/actions/timesheets";

type ClientTree = {
  id: string;
  companyName: string;
  projects: { id: string; name: string; sites: { id: string; name: string }[] }[];
};

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

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
  a.download = "timesheet-import-errors.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function TimesheetUploadWizard({ clients }: { clients: ClientTree[] }) {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [period, setPeriod] = useState(currentMonth());
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<TimesheetImportPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const projects = useMemo(() => clients.find((c) => c.id === clientId)?.projects ?? [], [clients, clientId]);
  const sites = useMemo(() => projects.find((p) => p.id === projectId)?.sites ?? [], [projects, projectId]);

  async function handlePreview() {
    if (!file) {
      toast.error("Please choose a file to upload.");
      return;
    }
    if (!siteId) {
      toast.error("Please select a site.");
      return;
    }
    setIsPreviewing(true);
    setPreview(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("siteId", siteId);
      const result = await previewTimesheetImport(formData);
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
    if (!preview || preview.validRows.length === 0) return;
    setIsImporting(true);
    try {
      const result = await importTimesheetRows({
        siteId,
        period: `${period}-01`,
        items: preview.validRows,
        fileName: file?.name,
        summary: preview.summary,
      });
      if (result.success) {
        toast.success("Timesheet imported.");
        router.push(`/timesheets/${result.data.id}`);
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel>Client *</FieldLabel>
            <Select
              value={clientId}
              onValueChange={(v) => {
                setClientId(v ?? "");
                setProjectId("");
                setSiteId("");
                setPreview(null);
              }}
              items={clients.map((c) => ({ value: c.id, label: c.companyName }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Project *</FieldLabel>
            <Select
              value={projectId}
              onValueChange={(v) => {
                setProjectId(v ?? "");
                setSiteId("");
                setPreview(null);
              }}
              disabled={!clientId}
              items={projects.map((p) => ({ value: p.id, label: p.name }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Site *</FieldLabel>
            <Select
              value={siteId}
              onValueChange={(v) => {
                setSiteId(v ?? "");
                setPreview(null);
              }}
              disabled={!projectId}
              items={sites.map((s) => ({ value: s.id, label: s.name }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Site" />
              </SelectTrigger>
              <SelectContent>
                {sites.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="period">Period (Month) *</FieldLabel>
            <Input
              id="period"
              type="month"
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value);
                setPreview(null);
              }}
            />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="file">Login Sheet (.xlsx) *</FieldLabel>
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
              Expected columns: Iqama, Date, Login, Logout, and optionally Name / Break (minutes).
            </p>
          </Field>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <Button variant="outline" nativeButton={false} render={<a href="/api/timesheets/import-template" />}>
            <Download className="size-4" />
            Download Excel Template
          </Button>
          <Button onClick={handlePreview} disabled={isPreviewing || !file || !siteId}>
            {isPreviewing && <Loader2 className="size-4 animate-spin" />}
            Preview Import
          </Button>
        </div>
      </div>

      {preview && (
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
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
            <span className="text-muted-foreground">{preview.summary.totalRows} total rows</span>
            {preview.summary.errorReport.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="ml-auto"
                onClick={() => downloadErrorReport(preview.summary.errorReport)}
              >
                <AlertTriangle className="size-3.5" />
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
                    <TableHead>Errors</TableHead>
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
                    <TableHead>Worker</TableHead>
                    <TableHead>Iqama</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Regular</TableHead>
                    <TableHead>Overtime</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.validRows.map((r) => (
                    <TableRow key={r.rowNumber}>
                      <TableCell>{r.rowNumber}</TableCell>
                      <TableCell>{r.workerName}</TableCell>
                      <TableCell>{r.iqamaNumber}</TableCell>
                      <TableCell>{new Date(r.date).toLocaleDateString("en-GB")}</TableCell>
                      <TableCell>{r.regularHours}h</TableCell>
                      <TableCell>{r.overtimeHours}h</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleImport} disabled={isImporting || preview.validRows.length === 0}>
              {isImporting && <Loader2 className="size-4 animate-spin" />}
              Confirm Import ({preview.validRows.length} rows)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
