"use client";

import { Loader2, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PAYROLL_ADJUSTMENT_TYPES,
  type PayrollAdjustmentFormInput,
} from "@/lib/validation/payroll";
import { addPayrollAdjustment, applyAdvanceRepaymentToPayroll, applyLoanRepaymentToPayroll } from "@/server/actions/payroll";

const ADJUSTMENT_LABELS: Record<(typeof PAYROLL_ADJUSTMENT_TYPES)[number], string> = {
  ALLOWANCE: "Allowance",
  BONUS: "Bonus",
  OTHER_DEDUCTION: "Other Deduction",
};

export function PayrollAdjustmentDialog({ workerPayrollId }: { workerPayrollId: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<PayrollAdjustmentFormInput["type"]>("ALLOWANCE");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await addPayrollAdjustment({
        workerPayrollId,
        type,
        amount: Number(amount),
        description,
      });
      if (result.success) {
        toast.success("Adjustment added.");
        setOpen(false);
        setAmount("");
        setDescription("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Plus className="size-4" />
            Add Adjustment
          </Button>
        }
      />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Payroll Adjustment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field>
            <FieldLabel>Type</FieldLabel>
            <Select value={type} onValueChange={(v) => v && setType(v as PayrollAdjustmentFormInput["type"])}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYROLL_ADJUSTMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {ADJUSTMENT_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="adj-amount">Amount (SAR) *</FieldLabel>
            <Input id="adj-amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="adj-description">Description *</FieldLabel>
            <Input
              id="adj-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Ramadan allowance"
            />
            {error && <FieldError>{error}</FieldError>}
          </Field>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={isPending || !amount || !description}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RepaymentDialog({
  workerPayrollId,
  kind,
  sources,
}: {
  workerPayrollId: string;
  kind: "ADVANCE" | "LOAN";
  sources: { id: string; label: string; remaining: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (sources.length === 0) return null;

  function submit() {
    setError(null);
    startTransition(async () => {
      const action = kind === "ADVANCE" ? applyAdvanceRepaymentToPayroll : applyLoanRepaymentToPayroll;
      const result = await action({ workerPayrollId, sourceId, amount: Number(amount) });
      if (result.success) {
        toast.success(`${kind === "ADVANCE" ? "Advance" : "Loan"} deduction applied.`);
        setOpen(false);
        setAmount("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Plus className="size-4" />
            Deduct {kind === "ADVANCE" ? "Advance" : "Loan"}
          </Button>
        }
      />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Deduct {kind === "ADVANCE" ? "Advance" : "Loan"} Repayment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field>
            <FieldLabel>{kind === "ADVANCE" ? "Advance" : "Loan"}</FieldLabel>
            <Select value={sourceId} onValueChange={(v) => v && setSourceId(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sources.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label} — remaining {s.remaining}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="repay-amount">Amount to Deduct (SAR) *</FieldLabel>
            <Input id="repay-amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            {error && <FieldError>{error}</FieldError>}
          </Field>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={isPending || !amount || !sourceId}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
