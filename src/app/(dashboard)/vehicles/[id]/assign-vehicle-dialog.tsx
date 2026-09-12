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
  DialogDescription,
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
  vehicleAssignFormSchema,
  type VehicleAssignFormInput,
  type VehicleAssignFormValues,
} from "@/lib/validation/vehicle";
import { assignVehicle } from "@/server/actions/vehicles";

type ClientTree = {
  id: string;
  companyName: string;
  projects: { id: string; name: string; sites: { id: string; name: string }[] }[];
};
type WorkerOption = { id: string; fullName: string; iqamaNumber: string };
type CoordinatorOption = { id: string; name: string };

export function AssignVehicleDialog({
  vehicleId,
  workers,
  clients,
  coordinators,
  trigger,
}: {
  vehicleId: string;
  workers: WorkerOption[];
  clients: ClientTree[];
  coordinators: CoordinatorOption[];
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const defaults: VehicleAssignFormValues = {
    vehicleId,
    workerId: "",
    coordinatorId: "",
    clientId: "",
    projectId: "",
    siteId: "",
    startDate: new Date().toISOString().slice(0, 10),
    expectedReturnDate: "",
    startingMileage: null,
    notes: "",
  };

  const form = useForm<VehicleAssignFormValues, unknown, VehicleAssignFormInput>({
    resolver: zodResolver(vehicleAssignFormSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;

  const selectedClientId = form.watch("clientId");
  const selectedProjectId = form.watch("projectId");

  const projects = useMemo(
    () => clients.find((c) => c.id === selectedClientId)?.projects ?? [],
    [clients, selectedClientId],
  );
  const sites = useMemo(
    () => projects.find((p) => p.id === selectedProjectId)?.sites ?? [],
    [projects, selectedProjectId],
  );

  async function onSubmit(values: VehicleAssignFormInput) {
    const result = await assignVehicle(values);
    if (result.success) {
      toast.success("Vehicle assigned.");
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
          <DialogTitle>Assign Vehicle</DialogTitle>
          <DialogDescription>Hand this vehicle to a worker. It stays deployed until returned.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup className="grid grid-cols-1 gap-4">
            <Field>
              <FieldLabel>Worker *</FieldLabel>
              <EntityCombobox
                entityType="worker"
                value={form.watch("workerId")}
                onChange={(v) => form.setValue("workerId", v)}
                placeholder="Search worker by name or Iqama..."
                error={errors.workerId?.message}
                required
              />
              {errors.workerId && <FieldError>{errors.workerId.message}</FieldError>}
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel>Client</FieldLabel>
                <EntityCombobox
                  entityType="client"
                  value={form.watch("clientId")}
                  onChange={(v) => {
                    form.setValue("clientId", v);
                    form.setValue("projectId", "");
                    form.setValue("siteId", "");
                  }}
                  placeholder="Select Client (Optional)"
                />
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="startDate">Start Date *</FieldLabel>
                <Input id="startDate" type="date" {...form.register("startDate")} />
                {errors.startDate && <FieldError>{errors.startDate.message}</FieldError>}
              </Field>
              <Field>
                <FieldLabel htmlFor="expectedReturnDate">Expected Return</FieldLabel>
                <Input id="expectedReturnDate" type="date" {...form.register("expectedReturnDate")} />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="startingMileage">Starting Mileage (km)</FieldLabel>
                <Input id="startingMileage" type="number" step="0.1" {...form.register("startingMileage")} />
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
              Assign Vehicle
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
