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
import { createAdvance } from "@/server/actions/finance";

export function AdvanceDialog({ workerId }: { workerId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const form = useForm<AdvanceFormValues, unknown, AdvanceFormInput>({
    resolver: zodResolver(advanceFormSchema),
    defaultValues: { workerId, amount: 0, dateGiven: today, reason: "" },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: AdvanceFormInput) {
    const result = await createAdvance(values);
    if (result.success) {
      toast.success("Advance recorded.");
      setOpen(false);
      form.reset({ workerId, amount: 0, dateGiven: today, reason: "" });
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Give Advance</Button>} />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Record Advance</DialogTitle>
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
              Record Advance
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
