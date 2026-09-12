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
import { EntityCombobox } from "@/components/shared/entity-combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  manualTimesheetItemFormSchema,
  type ManualTimesheetItemFormInput,
  type ManualTimesheetItemFormValues,
} from "@/lib/validation/timesheet";
import { createManualTimesheetItem } from "@/server/actions/timesheets";

type ClientTree = {
  id: string;
  companyName: string;
  projects: { id: string; name: string; sites: { id: string; name: string }[] }[];
};
type WorkerOption = { id: string; fullName: string; iqamaNumber: string };

export function ManualTimesheetEntryDialog({
  trigger,
  clients,
  workers,
}: {
  trigger: React.ReactElement;
  clients: ClientTree[];
  workers: WorkerOption[];
}) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const router = useRouter();

  const form = useForm<ManualTimesheetItemFormValues, unknown, ManualTimesheetItemFormInput>({
    resolver: zodResolver(manualTimesheetItemFormSchema),
    defaultValues: {
      workerId: "",
      siteId: "",
      date: new Date().toISOString().slice(0, 10),
      loginTime: "08:00",
      logoutTime: "17:00",
      breakMinutes: 60,
    },
  });

  const projects = useMemo(() => clients.find((c) => c.id === clientId)?.projects ?? [], [clients, clientId]);
  const sites = useMemo(() => projects.find((p) => p.id === projectId)?.sites ?? [], [projects, projectId]);

  async function onSubmit(values: ManualTimesheetItemFormInput) {
    const result = await createManualTimesheetItem(values);
    if (result.success) {
      toast.success("Timesheet entry added.");
      setOpen(false);
      form.reset();
      setClientId("");
      setProjectId("");
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
          <DialogTitle>Manual Timesheet Entry</DialogTitle>
          <DialogDescription>
            Record a single day of attendance for a worker directly, without an Excel upload.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup className="grid grid-cols-1 gap-4">

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel>Client *</FieldLabel>
                <EntityCombobox
                  entityType="client"
                  value={clientId}
                  onChange={(v) => {
                    setClientId(v);
                    setProjectId("");
                    form.setValue("siteId", "");
                  }}
                  placeholder="Select Client"
                />
              </Field>
              <Field>
                <FieldLabel>Project *</FieldLabel>
                <EntityCombobox
                  entityType="project"
                  value={projectId}
                  parentValue={clientId}
                  disabled={!clientId}
                  onChange={(v) => {
                    setProjectId(v);
                    form.setValue("siteId", "");
                  }}
                  placeholder={clientId ? "Select Project" : "Select client first"}
                />
              </Field>
              <Field>
                <FieldLabel>Site *</FieldLabel>
                <EntityCombobox
                  entityType="site"
                  value={form.watch("siteId")}
                  parentValue={projectId}
                  disabled={!projectId}
                  onChange={(v) => form.setValue("siteId", v)}
                  placeholder={projectId ? "Select Site" : "Select project first"}
                  error={errors.siteId?.message}
                  required
                />
                {errors.siteId && <FieldError>{errors.siteId.message}</FieldError>}
              </Field>
            </div>

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
              <p className="text-muted-foreground text-xs">
                The worker must have an active assignment at the selected site.
              </p>
            </Field>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field className="col-span-2 sm:col-span-1">
                <FieldLabel htmlFor="date">Date *</FieldLabel>
                <Input id="date" type="date" {...form.register("date")} />
                {errors.date && <FieldError>{errors.date.message}</FieldError>}
              </Field>
              <Field>
                <FieldLabel htmlFor="loginTime">Login *</FieldLabel>
                <Input id="loginTime" type="time" {...form.register("loginTime")} />
                {errors.loginTime && <FieldError>{errors.loginTime.message}</FieldError>}
              </Field>
              <Field>
                <FieldLabel htmlFor="logoutTime">Logout *</FieldLabel>
                <Input id="logoutTime" type="time" {...form.register("logoutTime")} />
                {errors.logoutTime && <FieldError>{errors.logoutTime.message}</FieldError>}
              </Field>
              <Field>
                <FieldLabel htmlFor="breakMinutes">Break (min)</FieldLabel>
                <Input id="breakMinutes" type="number" min={0} {...form.register("breakMinutes")} />
              </Field>
            </div>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Add Entry
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
