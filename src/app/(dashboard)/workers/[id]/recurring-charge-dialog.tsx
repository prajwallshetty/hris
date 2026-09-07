"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  BILLING_FREQUENCIES,
  RECURRING_CHARGE_CATEGORIES,
  recurringChargeFormSchema,
  type RecurringChargeFormInput,
  type RecurringChargeFormValues,
} from "@/lib/validation/recurring-charge";
import { createRecurringCharge, updateRecurringCharge } from "@/server/actions/recurring-charges";

export function RecurringChargeDialog({
  workerId,
  charge,
  trigger,
}: {
  workerId: string;
  charge?: {
    id: string;
    category: string;
    description: string | null;
    amount: number;
    frequency: string;
    startDate: string;
    endDate: string | null;
    depositAmount: number | null;
    depositPaid: boolean;
    notes: string | null;
  };
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = Boolean(charge);

  const defaults: RecurringChargeFormValues = {
    workerId,
    category: (charge?.category as RecurringChargeFormValues["category"]) ?? "HOUSING",
    description: charge?.description ?? "",
    amount: charge?.amount ?? 0,
    frequency: (charge?.frequency as RecurringChargeFormValues["frequency"]) ?? "MONTHLY",
    startDate: charge?.startDate ?? new Date().toISOString().slice(0, 10),
    endDate: charge?.endDate ?? "",
    depositAmount: charge?.depositAmount ?? null,
    depositPaid: charge?.depositPaid ?? false,
    notes: charge?.notes ?? "",
  };

  const form = useForm<RecurringChargeFormValues, unknown, RecurringChargeFormInput>({
    resolver: zodResolver(recurringChargeFormSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: RecurringChargeFormInput) {
    const result = isEdit ? await updateRecurringCharge(charge!.id, values) : await createRecurringCharge(values);
    if (result.success) {
      toast.success(isEdit ? "Charge updated." : "Recurring charge added.");
      setOpen(false);
      if (!isEdit) form.reset(defaults);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="sm">
              <Plus className="size-4" />
              Add Recurring Charge
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Recurring Charge" : "Add Recurring Charge"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Category *</FieldLabel>
                <Select
                  value={form.watch("category")}
                  onValueChange={(v) => v && form.setValue("category", v as RecurringChargeFormInput["category"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECURRING_CHARGE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Frequency *</FieldLabel>
                <Select
                  value={form.watch("frequency")}
                  onValueChange={(v) => v && form.setValue("frequency", v as RecurringChargeFormInput["frequency"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BILLING_FREQUENCIES.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f.replaceAll("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Input id="description" placeholder="e.g. Company accommodation, Block 4" {...form.register("description")} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="amount">Amount (SAR) *</FieldLabel>
                <Input id="amount" type="number" step="0.01" {...form.register("amount")} />
                {errors.amount && <FieldError>{errors.amount.message}</FieldError>}
              </Field>
              <Field>
                <FieldLabel htmlFor="depositAmount">Deposit (SAR)</FieldLabel>
                <Input id="depositAmount" type="number" step="0.01" {...form.register("depositAmount")} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="startDate">Start Date *</FieldLabel>
                <Input id="startDate" type="date" {...form.register("startDate")} />
                {errors.startDate && <FieldError>{errors.startDate.message}</FieldError>}
              </Field>
              <Field>
                <FieldLabel htmlFor="endDate">End Date</FieldLabel>
                <Input id="endDate" type="date" {...form.register("endDate")} />
              </Field>
            </div>
            <Field orientation="horizontal">
              <Checkbox
                id="depositPaid"
                checked={form.watch("depositPaid")}
                onCheckedChange={(checked) => form.setValue("depositPaid", checked === true)}
              />
              <FieldLabel htmlFor="depositPaid" className="font-normal">
                Deposit already paid
              </FieldLabel>
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
              {isEdit ? "Save Changes" : "Add Charge"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
