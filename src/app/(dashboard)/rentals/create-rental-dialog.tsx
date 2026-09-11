"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
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
import { EntityCombobox } from "@/components/shared/entity-combobox";
import {
  RENTAL_RATE_TYPES,
  equipmentRentalFormSchema,
  type EquipmentRentalFormInput,
  type EquipmentRentalFormValues,
} from "@/lib/validation/equipment";
import { createRental } from "@/server/actions/equipment";

type EquipmentOption = {
  id: string;
  name: string;
  serialNumber: string;
  hourlyRate: number | null;
  dailyRate: number | null;
  weeklyRate: number | null;
  monthlyRate: number | null;
};
type ClientTree = {
  id: string;
  companyName: string;
  projects: { id: string; name: string; sites: { id: string; name: string }[] }[];
};
type CoordinatorOption = { id: string; name: string };

const RATE_FIELD: Record<string, keyof EquipmentOption> = {
  HOURLY: "hourlyRate",
  DAILY: "dailyRate",
  WEEKLY: "weeklyRate",
  MONTHLY: "monthlyRate",
};

export function CreateRentalDialog({
  equipmentId,
  equipmentOptions,
  clients,
  coordinators,
  trigger,
}: {
  equipmentId?: string;
  equipmentOptions?: EquipmentOption[];
  clients: ClientTree[];
  coordinators: CoordinatorOption[];
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const defaults: EquipmentRentalFormValues = {
    equipmentId: equipmentId ?? "",
    clientId: "",
    projectId: "",
    siteId: "",
    coordinatorId: "",
    rateType: "DAILY",
    rateAmount: 0,
    quantity: 1,
    startDate: new Date().toISOString().slice(0, 10),
    expectedEndDate: "",
    notes: "",
  };

  const form = useForm<EquipmentRentalFormValues, unknown, EquipmentRentalFormInput>({
    resolver: zodResolver(equipmentRentalFormSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;

  const selectedEquipmentId = form.watch("equipmentId");
  const selectedRateType = form.watch("rateType");
  const selectedClientId = form.watch("clientId");
  const selectedProjectId = form.watch("projectId");

  const selectedEquipment = useMemo(
    () => equipmentOptions?.find((e) => e.id === selectedEquipmentId),
    [equipmentOptions, selectedEquipmentId],
  );
  const suggestedRate =
    selectedEquipment && selectedRateType in RATE_FIELD
      ? selectedEquipment[RATE_FIELD[selectedRateType]]
      : null;

  async function onSubmit(values: EquipmentRentalFormInput) {
    const result = await createRental(values);
    if (result.success) {
      toast.success("Rental created.");
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
          <DialogTitle>New Rental</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup className="grid grid-cols-1 gap-4">
            {!equipmentId && (
              <Field>
                <FieldLabel>Equipment *</FieldLabel>
                <EntityCombobox
                  entityType="equipment"
                  value={form.watch("equipmentId")}
                  onChange={(v) => form.setValue("equipmentId", v)}
                  placeholder="Select equipment..."
                  error={errors.equipmentId?.message}
                  required
                />
                {errors.equipmentId && <FieldError>{errors.equipmentId.message}</FieldError>}
              </Field>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel>Client *</FieldLabel>
                <EntityCombobox
                  entityType="client"
                  value={form.watch("clientId")}
                  onChange={(v) => {
                    form.setValue("clientId", v);
                    form.setValue("projectId", "");
                    form.setValue("siteId", "");
                  }}
                  placeholder="Select Client"
                  error={errors.clientId?.message}
                  required
                />
                {errors.clientId && <FieldError>{errors.clientId.message}</FieldError>}
              </Field>

              <Field>
                <FieldLabel>Project</FieldLabel>
                <EntityCombobox
                  entityType="project"
                  value={form.watch("projectId")}
                  parentValue={selectedClientId}
                  disabled={!selectedClientId}
                  onChange={(v) => {
                    form.setValue("projectId", v);
                    form.setValue("siteId", "");
                  }}
                  placeholder={selectedClientId ? "Select Project" : "Select client first"}
                />
              </Field>

              <Field>
                <FieldLabel>Site</FieldLabel>
                <EntityCombobox
                  entityType="site"
                  value={form.watch("siteId")}
                  parentValue={selectedProjectId}
                  disabled={!selectedProjectId}
                  onChange={(v) => form.setValue("siteId", v)}
                  placeholder={selectedProjectId ? "Select Site" : "Select project first"}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel>Coordinator</FieldLabel>
              <EntityCombobox
                entityType="coordinator"
                value={form.watch("coordinatorId")}
                onChange={(v) => form.setValue("coordinatorId", v)}
                placeholder="Select Coordinator (Optional)"
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel>Rate Type *</FieldLabel>
                <Select
                  value={form.watch("rateType")}
                  onValueChange={(v) => v && form.setValue("rateType", v as EquipmentRentalFormInput["rateType"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RENTAL_RATE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="rateAmount">
                  Rate Amount (SAR) * {suggestedRate != null && <span className="text-muted-foreground font-normal">(card: {suggestedRate})</span>}
                </FieldLabel>
                <Input id="rateAmount" type="number" step="0.01" {...form.register("rateAmount")} />
                {errors.rateAmount && <FieldError>{errors.rateAmount.message}</FieldError>}
              </Field>
              <Field>
                <FieldLabel htmlFor="quantity">Quantity</FieldLabel>
                <Input id="quantity" type="number" {...form.register("quantity")} />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="startDate">Start Date *</FieldLabel>
                <Input id="startDate" type="date" {...form.register("startDate")} />
                {errors.startDate && <FieldError>{errors.startDate.message}</FieldError>}
              </Field>
              <Field>
                <FieldLabel htmlFor="expectedEndDate">Expected End</FieldLabel>
                <Input id="expectedEndDate" type="date" {...form.register("expectedEndDate")} />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="notes">Notes</FieldLabel>
                <Textarea id="notes" rows={2} {...form.register("notes")} />
              </Field>
            </div>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Create Rental
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
