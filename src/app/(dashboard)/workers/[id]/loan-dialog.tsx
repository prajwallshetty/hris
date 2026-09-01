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
import { Textarea } from "@/components/ui/textarea";
import { loanFormSchema, type LoanFormInput, type LoanFormValues } from "@/lib/validation/finance";
import { createLoan } from "@/server/actions/finance";

export function LoanDialog({ workerId, employeeId }: { workerId?: string; employeeId?: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const defaults: LoanFormValues = {
    workerId: workerId ?? "",
    employeeId: employeeId ?? "",
    principalAmount: 0,
    dateGiven: today,
    reason: "",
  };
  const form = useForm<LoanFormValues, unknown, LoanFormInput>({
    resolver: zodResolver(loanFormSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: LoanFormInput) {
    const result = await createLoan(values);
    if (result.success) {
      toast.success("Loan recorded.");
      setOpen(false);
      form.reset(defaults);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Give Loan</Button>} />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Record Loan</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="principalAmount">Principal Amount (SAR) *</FieldLabel>
              <Input id="principalAmount" type="number" step="0.01" {...form.register("principalAmount")} />
              {errors.principalAmount && <FieldError>{errors.principalAmount.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="dateGiven">Date *</FieldLabel>
              <Input id="dateGiven" type="date" {...form.register("dateGiven")} />
              {errors.dateGiven && <FieldError>{errors.dateGiven.message}</FieldError>}
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="installments">Installments</FieldLabel>
                <Input id="installments" type="number" min={1} {...form.register("installments")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="installmentAmount">Installment Amount</FieldLabel>
                <Input id="installmentAmount" type="number" step="0.01" {...form.register("installmentAmount")} />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="reason">Reason</FieldLabel>
              <Textarea id="reason" rows={2} {...form.register("reason")} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Record Loan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
