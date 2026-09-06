"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Download, Loader2, Printer, Send } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SendReceiptDialog } from "@/components/finance/send-receipt-dialog";
import {
  PAYMENT_METHODS,
  WORKER_PAYMENT_TYPES,
  workerPaymentFormSchema,
  type WorkerPaymentFormInput,
  type WorkerPaymentFormValues,
} from "@/lib/validation/finance";
import { createWorkerPayment } from "@/server/actions/finance";

export function PaymentDialog({
  workerId,
  workerPayrollId,
  employeeId,
  employeePayrollId,
  workerName,
  workerMobile,
  trigger,
}: {
  workerId?: string;
  workerPayrollId?: string;
  employeeId?: string;
  employeePayrollId?: string;
  workerName?: string;
  workerMobile?: string;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [successPayment, setSuccessPayment] = useState<{
    id: string;
    receiptNumber: string;
    amount: number;
  } | null>(null);

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
      toast.success("Payment recorded successfully.");
      setSuccessPayment({
        id: result.data.id,
        receiptNumber: result.data.receiptNumber,
        amount: values.amount,
      });
      form.reset(defaults);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  function handleClose() {
    setOpen(false);
    setSuccessPayment(null);
  }

  return (
    <Dialog open={open} onOpenChange={(val) => {
      setOpen(val);
      if (!val) setSuccessPayment(null);
    }}>
      <DialogTrigger render={trigger ?? <Button size="sm">Record Payment</Button>} />
      <DialogContent className="max-w-md">
        {successPayment ? (
          <div className="py-2 space-y-4 text-center">
            <div className="mx-auto size-12 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-8" />
            </div>

            <div>
              <DialogTitle className="text-xl font-bold">Payment Confirmed</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Receipt <strong>{successPayment.receiptNumber}</strong> created for SAR {successPayment.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <a
                href={`/api/payments/${successPayment.id}/receipt?download=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full"
              >
                <Button className="w-full gap-2">
                  <Printer className="size-4" />
                  Download Receipt (PDF)
                </Button>
              </a>

              <SendReceiptDialog
                paymentId={successPayment.id}
                receiptNumber={successPayment.receiptNumber}
                recipientName={workerName || "Worker"}
                mobileNumber={workerMobile}
                amount={successPayment.amount}
                payrollPeriodName="Salary Payment"
              />
            </div>

            <DialogFooter className="sm:justify-center pt-2">
              <Button variant="ghost" onClick={handleClose}>
                Done
              </Button>
            </DialogFooter>
          </div>
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

