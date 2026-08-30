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

type WorkerOption = { id: string; fullName: string; iqamaNumber: string };
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
      workerHourlyRate: 0,
      clientBillingRate: 0,
      startDate: new Date().toISOString().slice(0, 10),
      coordinatorId: "",
      notes: "",
    },
  });

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

  async function onSubmit(values: AssignmentFormInput) {
    const result = await createAssignment(values);
    if (result.success) {
      toast.success("Assignment created.");
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
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Assignment</DialogTitle>
          <DialogDescription>
            Deploy a worker to a client site. Starting this assignment ends any current active
            assignment for the worker.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup className="grid grid-cols-1 gap-4">
            {workers && (
              <Field>
                <FieldLabel>Worker *</FieldLabel>
                <Select value={form.watch("workerId")} onValueChange={(v) => form.setValue("workerId", v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select worker" />
                  </SelectTrigger>
                  <SelectContent>
                    {workers.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.fullName} — {w.iqamaNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.workerId && <FieldError>{errors.workerId.message}</FieldError>}
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
                <FieldLabel>Project *</FieldLabel>
                <Select
                  value={form.watch("projectId")}
                  onValueChange={(v) => {
                    form.setValue("projectId", v ?? "");
                    form.setValue("siteId", "");
                  }}
                  disabled={!selectedClientId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.projectId && <FieldError>{errors.projectId.message}</FieldError>}
              </Field>
              <Field>
                <FieldLabel>Site *</FieldLabel>
                <Select
                  value={form.watch("siteId")}
                  onValueChange={(v) => form.setValue("siteId", v ?? "")}
                  disabled={!selectedProjectId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.siteId && <FieldError>{errors.siteId.message}</FieldError>}
              </Field>
            </div>

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
              <Field>
                <FieldLabel htmlFor="designation">Designation at Site</FieldLabel>
                <Input id="designation" {...form.register("designation")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="startDate">Start Date *</FieldLabel>
                <Input id="startDate" type="date" {...form.register("startDate")} />
                {errors.startDate && <FieldError>{errors.startDate.message}</FieldError>}
              </Field>
              <Field className="sm:col-span-2">
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
              Create Assignment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
