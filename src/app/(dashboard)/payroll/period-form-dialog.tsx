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
import {
  payrollPeriodFormSchema,
  type PayrollPeriodFormInput,
  type PayrollPeriodFormValues,
} from "@/lib/validation/payroll";
import { createPayrollPeriod } from "@/server/actions/payroll";

export function PayrollPeriodFormDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const defaults: PayrollPeriodFormValues = { name: "", periodStart: "", periodEnd: "" };
  const form = useForm<PayrollPeriodFormValues, unknown, PayrollPeriodFormInput>({
    resolver: zodResolver(payrollPeriodFormSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: PayrollPeriodFormInput) {
    const result = await createPayrollPeriod(values);
    if (result.success) {
      toast.success("Payroll period created.");
      setOpen(false);
      form.reset(defaults);
      router.push(`/payroll/${result.data.id}`);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus className="size-4" />
            New Payroll Period
          </Button>
        }
      />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New Payroll Period</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Name *</FieldLabel>
              <Input id="name" placeholder="e.g. August 2026" {...form.register("name")} />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="periodStart">Start Date *</FieldLabel>
                <Input id="periodStart" type="date" {...form.register("periodStart")} />
                {errors.periodStart && <FieldError>{errors.periodStart.message}</FieldError>}
              </Field>
              <Field>
                <FieldLabel htmlFor="periodEnd">End Date *</FieldLabel>
                <Input id="periodEnd" type="date" {...form.register("periodEnd")} />
                {errors.periodEnd && <FieldError>{errors.periodEnd.message}</FieldError>}
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Create Period
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
