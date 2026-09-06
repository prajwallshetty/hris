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
  rentalExtendFormSchema,
  type RentalExtendFormInput,
  type RentalExtendFormValues,
} from "@/lib/validation/equipment";
import { extendRental } from "@/server/actions/equipment";

export function ExtendRentalDialog({ rentalId, trigger }: { rentalId: string; trigger: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const defaults: RentalExtendFormValues = { newExpectedEndDate: "", notes: "" };

  const form = useForm<RentalExtendFormValues, unknown, RentalExtendFormInput>({
    resolver: zodResolver(rentalExtendFormSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: RentalExtendFormInput) {
    const result = await extendRental(rentalId, values);
    if (result.success) {
      toast.success("Rental extended.");
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
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Extend Rental</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="newExpectedEndDate">New Expected End Date *</FieldLabel>
              <Input id="newExpectedEndDate" type="date" {...form.register("newExpectedEndDate")} />
              {errors.newExpectedEndDate && <FieldError>{errors.newExpectedEndDate.message}</FieldError>}
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
              Extend
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
