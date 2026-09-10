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
import { advanceFormSchema, type AdvanceFormInput, type AdvanceFormValues } from "@/lib/validation/finance";
import { createAdvance, updateAdvance } from "@/server/actions/finance";

export function AdvanceDialog({
  workerId,
  employeeId,
  advanceId,
  defaultValues,
  trigger,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  workerId?: string;
  employeeId?: string;
  advanceId?: string;
  defaultValues?: AdvanceFormValues;
  trigger?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChangeProp ?? setInternalOpen;
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const defaults: AdvanceFormValues = defaultValues ?? {
    workerId: workerId ?? "",
    employeeId: employeeId ?? "",
    amount: 0,
    dateGiven: today,
    reason: "",
  };
  const form = useForm<AdvanceFormValues, unknown, AdvanceFormInput>({
    resolver: zodResolver(advanceFormSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: AdvanceFormInput) {
    const result = advanceId ? await updateAdvance(advanceId, values) : await createAdvance(values);
    if (result.success) {
      toast.success(advanceId ? "Advance updated." : "Advance recorded.");
      setOpen(false);
      if (!advanceId) form.reset(defaults);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger render={trigger} />}
      {!trigger && !advanceId && <DialogTrigger render={<Button size="sm">Give Advance</Button>} />}
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{advanceId ? "Edit Advance" : "Record Advance"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="amount">Amount (SAR) *</FieldLabel>
              <Input id="amount" type="number" step="0.01" {...form.register("amount")} />
              {errors.amount && <FieldError>{errors.amount.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="dateGiven">Date *</FieldLabel>
              <Input id="dateGiven" type="date" {...form.register("dateGiven")} />
              {errors.dateGiven && <FieldError>{errors.dateGiven.message}</FieldError>}
            </Field>
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
              {advanceId ? "Save Changes" : "Record Advance"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
