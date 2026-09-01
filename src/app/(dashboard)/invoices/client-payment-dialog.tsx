"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
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
import { PAYMENT_METHODS } from "@/lib/validation/finance";
import {
  clientPaymentFormSchema,
  type ClientPaymentFormInput,
  type ClientPaymentFormValues,
} from "@/lib/validation/invoice";
import { createClientPayment } from "@/server/actions/invoices";

export function ClientPaymentDialog({
  clientId,
  invoiceId,
  trigger,
}: {
  clientId: string;
  invoiceId?: string;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const defaults: ClientPaymentFormValues = {
    clientId,
    invoiceId: invoiceId ?? "",
    amount: 0,
    method: "BANK_TRANSFER",
    referenceNumber: "",
    date: today,
    remarks: "",
  };
  const form = useForm<ClientPaymentFormValues, unknown, ClientPaymentFormInput>({
    resolver: zodResolver(clientPaymentFormSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: ClientPaymentFormInput) {
    const result = await createClientPayment(values);
    if (result.success) {
      toast.success("Payment recorded.");
      setOpen(false);
      form.reset(defaults);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? <Button size="sm">Record Payment</Button>} />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Record Client Payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...form.register("invoiceId")} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="amount">Amount (SAR) *</FieldLabel>
              <Input id="amount" type="number" step="0.01" {...form.register("amount")} />
              {errors.amount && <FieldError>{errors.amount.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel>Method</FieldLabel>
              <Select value={form.watch("method")} onValueChange={(v) => v && form.setValue("method", v as ClientPaymentFormInput["method"])}>
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
      </DialogContent>
    </Dialog>
  );
}
