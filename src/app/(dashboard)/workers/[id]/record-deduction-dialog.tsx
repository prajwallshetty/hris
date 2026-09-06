"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
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
import {
  recurringChargeDeductionFormSchema,
  type RecurringChargeDeductionFormInput,
  type RecurringChargeDeductionFormValues,
} from "@/lib/validation/recurring-charge";
import { recordRecurringChargeDeduction } from "@/server/actions/recurring-charges";

export function RecordDeductionDialog({ chargeId }: { chargeId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const defaults: RecurringChargeDeductionFormValues = {
    chargeId,
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    notes: "",
  };

  const form = useForm<RecurringChargeDeductionFormValues, unknown, RecurringChargeDeductionFormInput>({
    resolver: zodResolver(recurringChargeDeductionFormSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: RecurringChargeDeductionFormInput) {
    const result = await recordRecurringChargeDeduction(values);
    if (result.success) {
      toast.success("Deduction recorded.");
      setOpen(false);
      form.reset(defaults);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="size-4" />
            Record Deduction
          </Button>
        }
      />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Record Deduction</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="amount">Amount (SAR) *</FieldLabel>
              <Input id="amount" type="number" step="0.01" {...form.register("amount")} />
              {errors.amount && <FieldError>{errors.amount.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="date">Date *</FieldLabel>
              <Input id="date" type="date" {...form.register("date")} />
              {errors.date && <FieldError>{errors.date.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="notes">Notes</FieldLabel>
              <Textarea id="notes" rows={2} {...form.register("notes")} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Record Deduction
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
