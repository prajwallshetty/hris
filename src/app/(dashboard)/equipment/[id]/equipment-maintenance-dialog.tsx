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
  equipmentMaintenanceFormSchema,
  type EquipmentMaintenanceFormInput,
  type EquipmentMaintenanceFormValues,
} from "@/lib/validation/equipment";
import { recordEquipmentMaintenance } from "@/server/actions/equipment";

const MAINTENANCE_STATUSES = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

export function EquipmentMaintenanceDialog({ equipmentId }: { equipmentId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const defaults: EquipmentMaintenanceFormValues = {
    equipmentId,
    maintenanceType: "",
    serviceDate: new Date().toISOString().slice(0, 10),
    nextServiceDate: "",
    cost: null,
    workshop: "",
    notes: "",
    status: "SCHEDULED",
  };

  const form = useForm<EquipmentMaintenanceFormValues, unknown, EquipmentMaintenanceFormInput>({
    resolver: zodResolver(equipmentMaintenanceFormSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: EquipmentMaintenanceFormInput) {
    const result = await recordEquipmentMaintenance(values);
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
          <DialogTitle>Record Equipment Maintenance</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="maintenanceType">Type *</FieldLabel>
              <Input id="maintenanceType" placeholder="Calibration, Servicing…" {...form.register("maintenanceType")} />
              {errors.maintenanceType && <FieldError>{errors.maintenanceType.message}</FieldError>}
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="serviceDate">Service Date</FieldLabel>
                <Input id="serviceDate" type="date" {...form.register("serviceDate")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="nextServiceDate">Next Due Date</FieldLabel>
                <Input id="nextServiceDate" type="date" {...form.register("nextServiceDate")} />
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
                  onValueChange={(v) => v && form.setValue("status", v as EquipmentMaintenanceFormInput["status"])}
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
