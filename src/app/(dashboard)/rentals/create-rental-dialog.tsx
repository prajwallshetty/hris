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

  const projects = useMemo(
    () => clients.find((c) => c.id === selectedClientId)?.projects ?? [],
    [clients, selectedClientId],
  );
  const sites = useMemo(
    () => projects.find((p) => p.id === selectedProjectId)?.sites ?? [],
    [projects, selectedProjectId],
  );

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
            {equipmentOptions && (
              <Field>
                <FieldLabel>Equipment *</FieldLabel>
                <Select value={form.watch("equipmentId")} onValueChange={(v) => form.setValue("equipmentId", v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select equipment" />
                  </SelectTrigger>
                  <SelectContent>
                    {equipmentOptions.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name} — {e.serialNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.equipmentId && <FieldError>{errors.equipmentId.message}</FieldError>}
              </Field>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel>Client *</FieldLabel>
                <Select
                  value={form.watch("clientId")}
                  onValueChange={(v) => {
                    form.setValue("clientId", v ?? "");
                    form.setValue("projectId", "");
                    form.setValue("siteId", "");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.companyName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.clientId && <FieldError>{errors.clientId.message}</FieldError>}
              </Field>
              <Field>
                <FieldLabel>Project</FieldLabel>
                <Select
                  value={form.watch("projectId") || "NONE"}
                  onValueChange={(v) => {
                    form.setValue("projectId", v === "NONE" ? "" : (v ?? ""));
                    form.setValue("siteId", "");
                  }}
                  disabled={!selectedClientId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Site</FieldLabel>
                <Select
                  value={form.watch("siteId") || "NONE"}
                  onValueChange={(v) => form.setValue("siteId", v === "NONE" ? "" : (v ?? ""))}
                  disabled={!selectedProjectId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Site" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None</SelectItem>
                    {sites.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

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
