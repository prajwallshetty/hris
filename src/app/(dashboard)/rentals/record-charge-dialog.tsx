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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  RENTAL_CHARGE_TYPES,
  rentalChargeFormSchema,
  type RentalChargeFormInput,
  type RentalChargeFormValues,
} from "@/lib/validation/equipment";
import { recordRentalCharge } from "@/server/actions/equipment";

export function RecordChargeDialog({ rentalId }: { rentalId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const defaults: RentalChargeFormValues = {
    rentalId,
    type: "OTHER",
    description: "",
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
  };

  const form = useForm<RentalChargeFormValues, unknown, RentalChargeFormInput>({
    resolver: zodResolver(rentalChargeFormSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: RentalChargeFormInput) {
    const result = await recordRentalCharge(values);
    if (result.success) {
      toast.success("Charge added.");
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
          <Button size="sm" variant="outline">
            <Plus className="size-4" />
            Add Charge
          </Button>
        }
      />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Charge</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Type *</FieldLabel>
                <Select
                  value={form.watch("type")}
                  onValueChange={(v) => v && form.setValue("type", v as RentalChargeFormInput["type"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RENTAL_CHARGE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.replaceAll("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="amount">Amount (SAR) *</FieldLabel>
                <Input id="amount" type="number" step="0.01" {...form.register("amount")} />
                {errors.amount && <FieldError>{errors.amount.message}</FieldError>}
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="date">Date *</FieldLabel>
              <Input id="date" type="date" {...form.register("date")} />
              {errors.date && <FieldError>{errors.date.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Textarea id="description" rows={2} {...form.register("description")} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Add Charge
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
