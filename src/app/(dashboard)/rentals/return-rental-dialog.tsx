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
import {
  rentalReturnFormSchema,
  type RentalReturnFormInput,
  type RentalReturnFormValues,
} from "@/lib/validation/equipment";
import { returnRental } from "@/server/actions/equipment";

export function ReturnRentalDialog({ rentalId, trigger }: { rentalId: string; trigger: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const defaults: RentalReturnFormValues = {
    actualReturnDate: new Date().toISOString().slice(0, 10),
    returnCondition: "",
    damageNotes: "",
    damageAmount: null,
    missingItemsNotes: "",
    missingItemsAmount: null,
    returnNotes: "",
  };

  const form = useForm<RentalReturnFormValues, unknown, RentalReturnFormInput>({
    resolver: zodResolver(rentalReturnFormSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;
  const hasDamage = Boolean(form.watch("damageNotes"));
  const hasMissingItems = Boolean(form.watch("missingItemsNotes"));

  async function onSubmit(values: RentalReturnFormInput) {
    const result = await returnRental(rentalId, values);
    if (result.success) {
      toast.success("Rental returned. Rental charge booked.");
      setOpen(false);
      form.reset(defaults);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Return Rental</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup className="grid grid-cols-1 gap-4">
            <Field>
              <FieldLabel htmlFor="actualReturnDate">Return Date *</FieldLabel>
              <Input id="actualReturnDate" type="date" {...form.register("actualReturnDate")} />
              {errors.actualReturnDate && <FieldError>{errors.actualReturnDate.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="returnCondition">Condition</FieldLabel>
              <Input id="returnCondition" placeholder="Good, Fair, Poor…" {...form.register("returnCondition")} />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="damageNotes">Damage Notes</FieldLabel>
                <Textarea id="damageNotes" rows={2} placeholder="Leave blank if none" {...form.register("damageNotes")} />
              </Field>
              {hasDamage && (
                <Field>
                  <FieldLabel htmlFor="damageAmount">Damage Charge (SAR)</FieldLabel>
                  <Input id="damageAmount" type="number" step="0.01" {...form.register("damageAmount")} />
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="missingItemsNotes">Missing Items</FieldLabel>
                <Textarea id="missingItemsNotes" rows={2} placeholder="Leave blank if none" {...form.register("missingItemsNotes")} />
              </Field>
              {hasMissingItems && (
                <Field>
                  <FieldLabel htmlFor="missingItemsAmount">Missing Item Charge (SAR)</FieldLabel>
                  <Input id="missingItemsAmount" type="number" step="0.01" {...form.register("missingItemsAmount")} />
                </Field>
              )}
            </div>
            <Field>
              <FieldLabel htmlFor="returnNotes">Notes</FieldLabel>
              <Textarea id="returnNotes" rows={2} {...form.register("returnNotes")} />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Return Rental
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
