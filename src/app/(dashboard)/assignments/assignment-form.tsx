"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Coins, Loader2 } from "lucide-react";
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
  assignmentFormSchema,
  type AssignmentFormInput,
  type AssignmentFormValues,
} from "@/lib/validation/assignment";
import { createAssignment } from "@/server/actions/assignments";

type ClientTree = {
  id: string;
  companyName: string;
  projects: { id: string; name: string; sites: { id: string; name: string }[] }[];
};

type WorkerOption = { id: string; fullName: string; iqamaNumber: string; hourlyRate?: number | null };
type Coordinator = { id: string; name: string };

export function AssignmentFormDialog({
  trigger,
  clients,
  coordinators,
  workers,
  presetWorkerId,
}: {
  trigger: React.ReactElement;
  clients: ClientTree[];
  coordinators: Coordinator[];
  workers?: WorkerOption[];
  presetWorkerId?: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const form = useForm<AssignmentFormValues, unknown, AssignmentFormInput>({
    resolver: zodResolver(assignmentFormSchema),
    defaultValues: {
      workerId: presetWorkerId ?? "",
      clientId: "",
      projectId: "",
      siteId: "",
      designation: "",
      workerHourlyRate: 15,
      clientBillingRate: 21,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: "",
      coordinatorId: "",
      notes: "",
    },
  });

  const selectedClientId = form.watch("clientId");
  const selectedProjectId = form.watch("projectId");
  const workerRate = Number(form.watch("workerHourlyRate") || 0);
  const clientRate = Number(form.watch("clientBillingRate") || 0);

  const marginSar = clientRate - workerRate;
  const marginPct = workerRate > 0 ? (marginSar / workerRate) * 100 : 0;

  async function onSubmit(values: AssignmentFormInput) {
    const result = await createAssignment(values);
    if (result.success) {
      toast.success("Worker assignment created successfully.");
      setOpen(false);
      form.reset();
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  const { errors, isSubmitting } = form.formState;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Assignment</DialogTitle>
          <DialogDescription>
            Deploy worker to client site. If the worker is currently assigned to another site, starting
            this deployment will automatically end the previous assignment while preserving full history.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FieldGroup className="space-y-4">
            {/* Step 1: Worker & Location */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">
                1. Deployment & Site Selection
              </h4>
              <div className="grid grid-cols-1 gap-4">
                {!presetWorkerId && (
                  <Field>
                    <FieldLabel>Worker *</FieldLabel>
                    <EntityCombobox
                      entityType="worker"
                      value={form.watch("workerId")}
                      onChange={(val, rawWorker) => {
                        form.setValue("workerId", val);
                        if (rawWorker?.hourlyRate) {
                          form.setValue("workerHourlyRate", Number(rawWorker.hourlyRate));
                        }
                      }}
                      placeholder="Search worker by name or Iqama..."
                      error={errors.workerId?.message}
                      required
                    />
                    {errors.workerId && <FieldError>{errors.workerId.message}</FieldError>}
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
                    <FieldLabel>Project *</FieldLabel>
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
                      error={errors.projectId?.message}
                      required
                    />
                    {errors.projectId && <FieldError>{errors.projectId.message}</FieldError>}
                  </Field>

                  <Field>
                    <FieldLabel>Site *</FieldLabel>
                    <EntityCombobox
                      entityType="site"
                      value={form.watch("siteId")}
                      parentValue={selectedProjectId}
                      disabled={!selectedProjectId}
                      onChange={(v) => form.setValue("siteId", v)}
                      placeholder={selectedProjectId ? "Select Site" : "Select project first"}
                      error={errors.siteId?.message}
                      required
                    />
                    {errors.siteId && <FieldError>{errors.siteId.message}</FieldError>}
                  </Field>
                </div>
              </div>
            </div>

            {/* Step 2: Commercial Rates & Margin */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">
                2. Rates & Financial Agreement
              </h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="workerHourlyRate">Worker Hourly Rate (SAR) *</FieldLabel>
                  <Input
                    id="workerHourlyRate"
                    type="number"
                    step="0.01"
                    {...form.register("workerHourlyRate")}
                  />
                  {errors.workerHourlyRate && <FieldError>{errors.workerHourlyRate.message}</FieldError>}
                </Field>
                <Field>
                  <FieldLabel htmlFor="clientBillingRate">Client Billing Rate (SAR) *</FieldLabel>
                  <Input
                    id="clientBillingRate"
                    type="number"
                    step="0.01"
                    {...form.register("clientBillingRate")}
                  />
                  {errors.clientBillingRate && <FieldError>{errors.clientBillingRate.message}</FieldError>}
                </Field>

                {/* Margin Preview Banner */}
                <div className="sm:col-span-2 p-3 rounded-lg border bg-muted/30 flex items-center justify-between text-xs">
                  <span className="font-medium text-muted-foreground flex items-center gap-1.5">
                    <Coins className="size-3.5 text-success" /> Project Margin Calculation:
                  </span>
                  <span className="tabular-nums font-semibold text-foreground">
                    SAR {marginSar.toFixed(2)}/hr ({marginPct >= 0 ? "+" : ""}{marginPct.toFixed(1)}% markup)
                  </span>
                </div>
              </div>
            </div>

            {/* Step 3: Dates & Coordinator */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">
                3. Deployment Schedule & Coordinator
              </h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="startDate">Start Date *</FieldLabel>
                  <Input id="startDate" type="date" {...form.register("startDate")} />
                  {errors.startDate && <FieldError>{errors.startDate.message}</FieldError>}
                </Field>
                <Field>
                  <FieldLabel htmlFor="endDate">End Date (Optional)</FieldLabel>
                  <Input id="endDate" type="date" {...form.register("endDate")} />
                  {errors.endDate && <FieldError>{errors.endDate.message}</FieldError>}
                </Field>
                <Field>
                  <FieldLabel htmlFor="designation">Designation at Site</FieldLabel>
                  <Input id="designation" placeholder="e.g. Senior Electrician" {...form.register("designation")} />
                </Field>
                <Field>
                  <FieldLabel>Site Coordinator</FieldLabel>
                  <EntityCombobox
                    entityType="coordinator"
                    value={form.watch("coordinatorId")}
                    onChange={(v) => form.setValue("coordinatorId", v)}
                    placeholder="Select Coordinator (Optional)"
                  />
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor="notes">Notes / Special Terms</FieldLabel>
                  <Textarea id="notes" rows={2} placeholder="Any specific requirements or contract terms..." {...form.register("notes")} />
                </Field>
              </div>
            </div>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Save & Deploy Worker
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

