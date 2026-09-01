"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateAdvancedCommission } from "@/server/actions/coordinator-finance";

type RuleOption = { id: string; type: string; rateOrAmount: string; coordinatorId: string | null };
type InvoiceOption = { id: string; sequenceNo: number; totalAmount: string; clientName: string };
type ClientOption = { id: string; companyName: string };

const TYPE_LABELS: Record<string, string> = {
  PERCENT_OF_INVOICE: "% of Invoice",
  PERCENT_OF_PROFIT: "% of Client Profit",
  PER_WORKER: "Per Active Worker",
  PER_HOUR: "Per Approved Hour",
};

export function GenerateAdvancedCommissionDialog({
  coordinatorId,
  rules,
  invoices,
  clients,
}: {
  coordinatorId: string;
  rules: RuleOption[];
  invoices: InvoiceOption[];
  clients: ClientOption[];
}) {
  const advancedRules = rules.filter((r) => r.type !== "PERCENT_OF_SALES" && r.type !== "FIXED_AMOUNT");
  const [open, setOpen] = useState(false);
  const [ruleId, setRuleId] = useState(advancedRules[0]?.id ?? "");
  const [invoiceId, setInvoiceId] = useState("");
  const [clientId, setClientId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  if (advancedRules.length === 0) return null;
  const selectedRule = advancedRules.find((r) => r.id === ruleId);

  async function submit() {
    if (!selectedRule) return;
    setIsSubmitting(true);
    try {
      const base = { coordinatorId, commissionRuleId: selectedRule!.id };
      const input =
        selectedRule!.type === "PERCENT_OF_INVOICE"
          ? { ...base, type: "PERCENT_OF_INVOICE" as const, invoiceId }
          : selectedRule!.type === "PERCENT_OF_PROFIT"
            ? { ...base, type: "PERCENT_OF_PROFIT" as const, clientId, periodStart, periodEnd }
            : selectedRule!.type === "PER_WORKER"
              ? { ...base, type: "PER_WORKER" as const }
              : { ...base, type: "PER_HOUR" as const, periodStart, periodEnd };

      const result = await generateAdvancedCommission(input);
      if (result.success) {
        toast.success("Commission generated.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const needsInvoice = selectedRule?.type === "PERCENT_OF_INVOICE";
  const needsClient = selectedRule?.type === "PERCENT_OF_PROFIT";
  const needsPeriod = selectedRule?.type === "PERCENT_OF_PROFIT" || selectedRule?.type === "PER_HOUR";

  const canSubmit =
    Boolean(selectedRule) &&
    (!needsInvoice || Boolean(invoiceId)) &&
    (!needsClient || Boolean(clientId)) &&
    (!needsPeriod || (Boolean(periodStart) && Boolean(periodEnd)));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <Sparkles className="size-4" />
            Generate (Other Basis)
          </Button>
        }
      />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Generate Commission</DialogTitle>
          <DialogDescription>For rules based on an invoice, client profit, worker count, or hours.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field>
            <FieldLabel>Commission Rule *</FieldLabel>
            <Select value={ruleId} onValueChange={(v) => v && setRuleId(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a rule" />
              </SelectTrigger>
              <SelectContent>
                {advancedRules.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {TYPE_LABELS[r.type] ?? r.type} — {r.rateOrAmount}
                    {r.type.startsWith("PERCENT") ? "%" : ""}
                    {r.coordinatorId ? " (coordinator-specific)" : " (default)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {needsInvoice && (
            <Field>
              <FieldLabel>Invoice *</FieldLabel>
              <Select value={invoiceId} onValueChange={(v) => v && setInvoiceId(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an invoice" />
                </SelectTrigger>
                <SelectContent>
                  {invoices.map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>
                      #{inv.sequenceNo} — {inv.clientName} — SAR {inv.totalAmount}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          {needsClient && (
            <Field>
              <FieldLabel>Client *</FieldLabel>
              <Select value={clientId} onValueChange={(v) => v && setClientId(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a client" />
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
          )}

          {needsPeriod && (
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="periodStart">Start Date *</FieldLabel>
                <Input id="periodStart" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="periodEnd">End Date *</FieldLabel>
                <Input id="periodEnd" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
              </Field>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={isSubmitting || !canSubmit}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
