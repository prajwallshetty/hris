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
  EQUIPMENT_STATUSES,
  equipmentFormSchema,
  type EquipmentFormInput,
  type EquipmentFormValues,
} from "@/lib/validation/equipment";
import { createEquipment, updateEquipment } from "@/server/actions/equipment";

type CoordinatorOption = { id: string; name: string };

export function EquipmentFormDialog({
  trigger,
  coordinators,
  equipment,
}: {
  trigger: React.ReactElement;
  coordinators: CoordinatorOption[];
  equipment?: {
    id: string;
    serialNumber: string;
    name: string;
    category: string | null;
    make: string | null;
    model: string | null;
    condition: string | null;
    status: string;
    hourlyRate: number | null;
    dailyRate: number | null;
    weeklyRate: number | null;
    monthlyRate: number | null;
    ownerCompany: string | null;
    coordinatorId: string | null;
    notes: string | null;
  };
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = Boolean(equipment);

  const defaults: EquipmentFormValues = {
    serialNumber: equipment?.serialNumber ?? "",
    name: equipment?.name ?? "",
    category: equipment?.category ?? "",
    make: equipment?.make ?? "",
    model: equipment?.model ?? "",
    condition: equipment?.condition ?? "",
    status: (equipment?.status as EquipmentFormValues["status"]) ?? "AVAILABLE",
    hourlyRate: equipment?.hourlyRate ?? null,
    dailyRate: equipment?.dailyRate ?? null,
    weeklyRate: equipment?.weeklyRate ?? null,
    monthlyRate: equipment?.monthlyRate ?? null,
    ownerCompany: equipment?.ownerCompany ?? "",
    coordinatorId: equipment?.coordinatorId ?? "",
    notes: equipment?.notes ?? "",
  };

  const form = useForm<EquipmentFormValues, unknown, EquipmentFormInput>({
    resolver: zodResolver(equipmentFormSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: EquipmentFormInput) {
    const result = isEdit ? await updateEquipment(equipment!.id, values) : await createEquipment(values);
    if (result.success) {
      toast.success(isEdit ? "Equipment updated." : "Equipment added.");
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
          <DialogTitle>{isEdit ? "Edit Equipment" : "Add Equipment"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="serialNumber">Serial Number *</FieldLabel>
                <Input id="serialNumber" {...form.register("serialNumber")} />
                {errors.serialNumber && <FieldError>{errors.serialNumber.message}</FieldError>}
              </Field>
              <Field>
                <FieldLabel htmlFor="name">Name *</FieldLabel>
                <Input id="name" placeholder="Generator, Compressor…" {...form.register("name")} />
                {errors.name && <FieldError>{errors.name.message}</FieldError>}
              </Field>
              <Field>
                <FieldLabel htmlFor="category">Category</FieldLabel>
                <Input id="category" {...form.register("category")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="condition">Condition</FieldLabel>
                <Input id="condition" placeholder="Good, Fair, Poor…" {...form.register("condition")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="make">Make</FieldLabel>
                <Input id="make" {...form.register("make")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="model">Model</FieldLabel>
                <Input id="model" {...form.register("model")} />
              </Field>
            </div>

            {isEdit && (
              <Field>
                <FieldLabel>Status</FieldLabel>
                <Select
                  value={form.watch("status")}
                  onValueChange={(v) => v && form.setValue("status", v as EquipmentFormInput["status"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EQUIPMENT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replaceAll("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field>
                <FieldLabel htmlFor="hourlyRate">Hourly Rate</FieldLabel>
                <Input id="hourlyRate" type="number" step="0.01" {...form.register("hourlyRate")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="dailyRate">Daily Rate</FieldLabel>
                <Input id="dailyRate" type="number" step="0.01" {...form.register("dailyRate")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="weeklyRate">Weekly Rate</FieldLabel>
                <Input id="weeklyRate" type="number" step="0.01" {...form.register("weeklyRate")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="monthlyRate">Monthly Rate</FieldLabel>
                <Input id="monthlyRate" type="number" step="0.01" {...form.register("monthlyRate")} />
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
              {isEdit ? "Save Changes" : "Add Equipment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
