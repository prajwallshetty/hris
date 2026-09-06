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
  MAINTENANCE_STATUSES,
  vehicleMaintenanceFormSchema,
  type VehicleMaintenanceFormInput,
  type VehicleMaintenanceFormValues,
} from "@/lib/validation/vehicle";
import { recordVehicleMaintenance } from "@/server/actions/vehicles";

export function VehicleMaintenanceDialog({ vehicleId }: { vehicleId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const defaults: VehicleMaintenanceFormValues = {
    vehicleId,
    maintenanceType: "",
    serviceDate: new Date().toISOString().slice(0, 10),
    serviceMileage: null,
    nextServiceDate: "",
    nextServiceMileage: null,
    cost: null,
    workshop: "",
    notes: "",
    status: "SCHEDULED",
  };

  const form = useForm<VehicleMaintenanceFormValues, unknown, VehicleMaintenanceFormInput>({
    resolver: zodResolver(vehicleMaintenanceFormSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: VehicleMaintenanceFormInput) {
    const result = await recordVehicleMaintenance(values);
    if (result.success) {
      toast.success("Maintenance recorded.");
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
            Record Maintenance
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Vehicle Maintenance</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="maintenanceType">Type *</FieldLabel>
              <Input id="maintenanceType" placeholder="Oil change, Tire rotation…" {...form.register("maintenanceType")} />
              {errors.maintenanceType && <FieldError>{errors.maintenanceType.message}</FieldError>}
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="serviceDate">Service Date</FieldLabel>
                <Input id="serviceDate" type="date" {...form.register("serviceDate")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="serviceMileage">Mileage (km)</FieldLabel>
                <Input id="serviceMileage" type="number" step="0.1" {...form.register("serviceMileage")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="nextServiceDate">Next Due Date</FieldLabel>
                <Input id="nextServiceDate" type="date" {...form.register("nextServiceDate")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="nextServiceMileage">Next Due Mileage</FieldLabel>
                <Input id="nextServiceMileage" type="number" step="0.1" {...form.register("nextServiceMileage")} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="cost">Cost (SAR)</FieldLabel>
                <Input id="cost" type="number" step="0.01" {...form.register("cost")} />
              </Field>
              <Field>
                <FieldLabel>Status</FieldLabel>
                <Select
                  value={form.watch("status")}
                  onValueChange={(v) => v && form.setValue("status", v as VehicleMaintenanceFormInput["status"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MAINTENANCE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replaceAll("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="workshop">Workshop</FieldLabel>
              <Input id="workshop" {...form.register("workshop")} />
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
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
