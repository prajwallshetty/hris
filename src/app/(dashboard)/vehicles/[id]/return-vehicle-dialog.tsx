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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  vehicleReturnFormSchema,
  type VehicleReturnFormInput,
  type VehicleReturnFormValues,
} from "@/lib/validation/vehicle";
import { returnVehicle } from "@/server/actions/vehicles";

export function ReturnVehicleDialog({
  assignmentId,
  workerName,
  trigger,
}: {
  assignmentId: string;
  workerName: string;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const defaults: VehicleReturnFormValues = {
    endingMileage: null,
    condition: "",
    damageNotes: "",
    fuelLevel: "",
    returnNotes: "",
    returnedById: "",
    receivedById: "",
    damageAmount: null,
  };

  const form = useForm<VehicleReturnFormValues, unknown, VehicleReturnFormInput>({
    resolver: zodResolver(vehicleReturnFormSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;
  const hasDamage = Boolean(form.watch("damageNotes"));

  async function onSubmit(values: VehicleReturnFormInput) {
    const result = await returnVehicle(assignmentId, values);
    if (result.success) {
      toast.success("Vehicle returned.");
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
          <DialogTitle>Return Vehicle</DialogTitle>
          <DialogDescription>Record the vehicle&apos;s condition as it comes back from {workerName}.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="endingMileage">Ending Mileage (km)</FieldLabel>
                <Input id="endingMileage" type="number" step="0.1" {...form.register("endingMileage")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="fuelLevel">Fuel Level</FieldLabel>
                <Input id="fuelLevel" placeholder="Full, Half, Quarter…" {...form.register("fuelLevel")} />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="condition">Condition</FieldLabel>
                <Input id="condition" placeholder="Good, Fair, Poor…" {...form.register("condition")} />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="damageNotes">Damage Notes</FieldLabel>
                <Textarea id="damageNotes" rows={2} placeholder="Leave blank if no damage" {...form.register("damageNotes")} />
              </Field>
              {hasDamage && (
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor="damageAmount">Repair Cost (SAR)</FieldLabel>
                  <Input id="damageAmount" type="number" step="0.01" {...form.register("damageAmount")} />
                  {errors.damageAmount && <FieldError>{errors.damageAmount.message}</FieldError>}
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="returnedById">Returned By</FieldLabel>
                <Input id="returnedById" {...form.register("returnedById")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="receivedById">Received By</FieldLabel>
                <Input id="receivedById" {...form.register("receivedById")} />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="returnNotes">Notes</FieldLabel>
                <Textarea id="returnNotes" rows={2} {...form.register("returnNotes")} />
              </Field>
            </div>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Return Vehicle
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
