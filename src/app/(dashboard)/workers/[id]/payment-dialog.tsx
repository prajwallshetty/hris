"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  PAYMENT_METHODS,
  WORKER_PAYMENT_TYPES,
  workerPaymentFormSchema,
  type WorkerPaymentFormInput,
  type WorkerPaymentFormValues,
} from "@/lib/validation/finance";
import { createWorkerPayment, type WorkerPaymentReceipt } from "@/server/actions/finance";

function formatMoney(value: number) {
  return `SAR ${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export function PaymentDialog({
  workerId,
  workerPayrollId,
  employeeId,
  employeePayrollId,
  trigger,
}: {
  workerId?: string;
  workerPayrollId?: string;
  employeeId?: string;
  employeePayrollId?: string;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [receipt, setReceipt] = useState<WorkerPaymentReceipt | null>(null);
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const defaults: WorkerPaymentFormValues = {
    workerId: workerId ?? "",
    workerPayrollId: workerPayrollId ?? "",
    employeeId: employeeId ?? "",
    employeePayrollId: employeePayrollId ?? "",
    amount: 0,
    paymentType: "SALARY",
    method: "BANK_TRANSFER",
    referenceNumber: "",
    date: today,
    remarks: "",
  };
  const form = useForm<WorkerPaymentFormValues, unknown, WorkerPaymentFormInput>({
    resolver: zodResolver(workerPaymentFormSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: WorkerPaymentFormInput) {
    const result = await createWorkerPayment(values);
    if (result.success) {
      setReceipt(result.data);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  function handleDone() {
    setOpen(false);
    setReceipt(null);
    form.reset(defaults);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setReceipt(null);
          form.reset(defaults);
        }
      }}
    >
      <DialogTrigger render={trigger ?? <Button size="sm">Record Payment</Button>} />
      <DialogContent className="max-w-sm">
        {receipt ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="text-success size-5" />
                Payment Successful
              </DialogTitle>
              <DialogDescription>The payment has been recorded and the balance updated.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 rounded-lg border p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Receipt Number</span>
                <span className="font-mono font-semibold">{receipt.receiptNumber}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Amount Paid</span>
                <span className="font-semibold">{formatMoney(receipt.amount)}</span>
              </div>
              {receipt.outstanding !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Remaining Balance</span>
                  <span className={receipt.outstanding > 0 ? "text-warning-foreground font-medium" : "text-success font-medium"}>
                    {formatMoney(receipt.outstanding)}
                  </span>
                </div>
              )}
            </div>
            <DialogFooter>
              {workerId && (
                <Button
                  variant="outline"
                  render={<Link href={`/workers/${workerId}/payments/${receipt.id}/receipt`}>View Receipt</Link>}
                />
              )}
              <Button onClick={handleDone}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <input type="hidden" {...form.register("workerPayrollId")} />
              <input type="hidden" {...form.register("employeeId")} />
              <input type="hidden" {...form.register("employeePayrollId")} />
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="amount">Amount (SAR) *</FieldLabel>
                  <Input id="amount" type="number" step="0.01" {...form.register("amount")} />
                  {errors.amount && <FieldError>{errors.amount.message}</FieldError>}
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel>Type</FieldLabel>
                    <Select
                      value={form.watch("paymentType")}
                      onValueChange={(v) => v && form.setValue("paymentType", v as WorkerPaymentFormInput["paymentType"])}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WORKER_PAYMENT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>Method</FieldLabel>
                    <Select
                      value={form.watch("method")}
                      onValueChange={(v) => v && form.setValue("method", v as WorkerPaymentFormInput["method"])}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((method) => (
                          <SelectItem key={method} value={method}>
                            {method.replaceAll("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="date">Date *</FieldLabel>
                  <Input id="date" type="date" {...form.register("date")} />
                  {errors.date && <FieldError>{errors.date.message}</FieldError>}
                </Field>
                <Field>
                  <FieldLabel htmlFor="referenceNumber">Reference Number</FieldLabel>
                  <Input id="referenceNumber" {...form.register("referenceNumber")} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="remarks">Remarks</FieldLabel>
                  <Textarea id="remarks" rows={2} {...form.register("remarks")} />
                </Field>
              </FieldGroup>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  Record Payment
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
