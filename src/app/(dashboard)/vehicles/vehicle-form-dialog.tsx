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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  VEHICLE_STATUSES,
  vehicleFormSchema,
  type VehicleFormInput,
  type VehicleFormValues,
} from "@/lib/validation/vehicle";
import { createVehicle, updateVehicle } from "@/server/actions/vehicles";

type CoordinatorOption = { id: string; name: string };

export function VehicleFormDialog({
  trigger,
  coordinators,
  vehicle,
}: {
  trigger: React.ReactElement;
  coordinators: CoordinatorOption[];
  vehicle?: {
    id: string;
    plateNumber: string;
    make: string;
    model: string;
    year: number | null;
    color: string | null;
    vehicleType: string | null;
    vin: string | null;
    currentMileage: number | null;
    status: string;
    registrationExpiry: string | null;
    insuranceExpiry: string | null;
    inspectionExpiry: string | null;
    ownerCompany: string | null;
    coordinatorId: string | null;
    notes: string | null;
  };
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = Boolean(vehicle);

  const defaults: VehicleFormValues = {
    plateNumber: vehicle?.plateNumber ?? "",
    make: vehicle?.make ?? "",
    model: vehicle?.model ?? "",
    year: vehicle?.year ?? null,
    color: vehicle?.color ?? "",
    vehicleType: vehicle?.vehicleType ?? "",
    vin: vehicle?.vin ?? "",
    currentMileage: vehicle?.currentMileage ?? null,
    status: (vehicle?.status as VehicleFormValues["status"]) ?? "AVAILABLE",
    registrationExpiry: vehicle?.registrationExpiry ?? "",
    insuranceExpiry: vehicle?.insuranceExpiry ?? "",
    inspectionExpiry: vehicle?.inspectionExpiry ?? "",
    ownerCompany: vehicle?.ownerCompany ?? "",
    coordinatorId: vehicle?.coordinatorId ?? "",
    notes: vehicle?.notes ?? "",
  };

  const form = useForm<VehicleFormValues, unknown, VehicleFormInput>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: VehicleFormInput) {
    const result = isEdit ? await updateVehicle(vehicle!.id, values) : await createVehicle(values);
    if (result.success) {
      toast.success(isEdit ? "Vehicle updated." : "Vehicle added.");
      setOpen(false);
      if (!isEdit) form.reset(defaults);
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
          <DialogTitle>{isEdit ? "Edit Vehicle" : "Add Vehicle"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="plateNumber">Plate Number *</FieldLabel>
                <Input id="plateNumber" {...form.register("plateNumber")} />
                {errors.plateNumber && <FieldError>{errors.plateNumber.message}</FieldError>}
              </Field>
              <Field>
                <FieldLabel htmlFor="vehicleType">Type</FieldLabel>
                <Input id="vehicleType" placeholder="Pickup, Sedan, Bus…" {...form.register("vehicleType")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="make">Make *</FieldLabel>
                <Input id="make" {...form.register("make")} />
                {errors.make && <FieldError>{errors.make.message}</FieldError>}
              </Field>
              <Field>
                <FieldLabel htmlFor="model">Model *</FieldLabel>
                <Input id="model" {...form.register("model")} />
                {errors.model && <FieldError>{errors.model.message}</FieldError>}
              </Field>
              <Field>
                <FieldLabel htmlFor="year">Year</FieldLabel>
                <Input id="year" type="number" {...form.register("year")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="color">Color</FieldLabel>
                <Input id="color" {...form.register("color")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="vin">VIN</FieldLabel>
                <Input id="vin" {...form.register("vin")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="currentMileage">Current Mileage (km)</FieldLabel>
                <Input id="currentMileage" type="number" step="0.1" {...form.register("currentMileage")} />
              </Field>
            </div>

            {isEdit && (
              <Field>
                <FieldLabel>Status</FieldLabel>
                <Select
                  value={form.watch("status")}
                  onValueChange={(v) => v && form.setValue("status", v as VehicleFormInput["status"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VEHICLE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replaceAll("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="registrationExpiry">Registration Expiry</FieldLabel>
                <Input id="registrationExpiry" type="date" {...form.register("registrationExpiry")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="insuranceExpiry">Insurance Expiry</FieldLabel>
                <Input id="insuranceExpiry" type="date" {...form.register("insuranceExpiry")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="inspectionExpiry">Inspection Expiry</FieldLabel>
                <Input id="inspectionExpiry" type="date" {...form.register("inspectionExpiry")} />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="ownerCompany">Owner Company</FieldLabel>
                <Input id="ownerCompany" {...form.register("ownerCompany")} />
              </Field>
              <Field>
                <FieldLabel>Coordinator</FieldLabel>
                <Select
                  value={form.watch("coordinatorId") || "NONE"}
                  onValueChange={(v) => form.setValue("coordinatorId", v === "NONE" ? "" : (v ?? ""))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None</SelectItem>
                    {coordinators.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

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
              {isEdit ? "Save Changes" : "Add Vehicle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
