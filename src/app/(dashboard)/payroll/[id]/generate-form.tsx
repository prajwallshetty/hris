"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateWorkerPayroll } from "@/server/actions/payroll";

type ClientTree = {
  id: string;
  companyName: string;
  projects: { id: string; name: string; sites: { id: string; name: string }[] }[];
};
type WorkerOption = { id: string; fullName: string; iqamaNumber: string };

export function GeneratePayrollForm({
  payrollPeriodId,
  clients,
  workers,
}: {
  payrollPeriodId: string;
  clients: ClientTree[];
  workers: WorkerOption[];
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const sites = useMemo(
    () => clients.find((c) => c.id === clientId)?.projects.flatMap((p) => p.sites) ?? [],
    [clients, clientId],
  );

  async function handleGenerate() {
    setIsGenerating(true);
    try {
      const result = await generateWorkerPayroll({ payrollPeriodId, clientId, siteId, workerId });
      if (result.success) {
        toast.success(
          `Generated payroll for ${result.data.generated} worker(s).` +
            (result.data.skippedAlreadyGenerated > 0
              ? ` Skipped ${result.data.skippedAlreadyGenerated} already generated.`
              : ""),
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="rounded-lg border p-4">
      <p className="mb-3 text-sm font-medium">Generate Payroll</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Field>
          <FieldLabel>Client</FieldLabel>
          <Select
            value={clientId || "ALL"}
            onValueChange={(v) => {
              setClientId(v === "ALL" ? "" : (v ?? ""));
              setSiteId("");
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All clients</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.companyName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Site</FieldLabel>
          <Select value={siteId || "ALL"} onValueChange={(v) => setSiteId(v === "ALL" ? "" : (v ?? ""))} disabled={!clientId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All sites" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All sites</SelectItem>
              {sites.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Worker</FieldLabel>
          <Select value={workerId || "ALL"} onValueChange={(v) => setWorkerId(v === "ALL" ? "" : (v ?? ""))}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All workers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All workers</SelectItem>
              {workers.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.fullName} — {w.iqamaNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="flex items-end">
          <Button onClick={handleGenerate} disabled={isGenerating} className="w-full">
            {isGenerating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Generate
          </Button>
        </div>
      </div>
      <p className="text-muted-foreground mt-2 text-xs">
        Only pulls hours from Locked timesheets. Workers who already have payroll for this period are skipped.
      </p>
    </div>
  );
}
