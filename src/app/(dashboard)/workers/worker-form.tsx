"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  WORKER_STATUSES,
  workerFormSchema,
  type WorkerFormInput,
  type WorkerFormValues,
} from "@/lib/validation/worker";
import { createWorker, updateWorker } from "@/server/actions/workers";

type Coordinator = { id: string; name: string };

export function WorkerForm({
  workerId,
  defaultValues,
  coordinators,
}: {
  workerId?: string;
  defaultValues?: Partial<WorkerFormValues>;
  coordinators: Coordinator[];
}) {
  const router = useRouter();
  const form = useForm<WorkerFormValues, unknown, WorkerFormInput>({
    resolver: zodResolver(workerFormSchema),
    defaultValues: {
      iqamaNumber: "",
      fullName: "",
      mobile: "",
      passportNumber: "",
      passportExpiryDate: "",
      iqamaExpiryDate: "",
      nationality: "",
      dateOfBirth: "",
      designation: "",
      skillCategory: "",
      joiningDate: "",
      mobilizationDate: "",
      demobilizationDate: "",
      coordinatorId: "",
      hourlyRate: undefined,
      overtimeRate: undefined,
      status: "AVAILABLE",
      bankName: "",
      bankAccountIban: "",
      notes: "",
      ...defaultValues,
    },
  });

  async function onSubmit(values: WorkerFormInput) {
    const result = workerId ? await updateWorker(workerId, values) : await createWorker(values);
    if (result.success) {
      toast.success(workerId ? "Worker updated." : "Worker created.");
      router.push(`/workers/${result.data.id}`);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  const { errors, isSubmitting } = form.formState;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identity</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="iqamaNumber">Iqama Number *</FieldLabel>
              <Input id="iqamaNumber" {...form.register("iqamaNumber")} placeholder="10 digits" />
              {errors.iqamaNumber && <FieldError>{errors.iqamaNumber.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="fullName">Full Name *</FieldLabel>
              <Input id="fullName" {...form.register("fullName")} />
              {errors.fullName && <FieldError>{errors.fullName.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="iqamaExpiryDate">Iqama Expiry Date</FieldLabel>
              <Input id="iqamaExpiryDate" type="date" {...form.register("iqamaExpiryDate")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="mobile">Mobile</FieldLabel>
              <Input id="mobile" {...form.register("mobile")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="passportNumber">Passport Number</FieldLabel>
              <Input id="passportNumber" {...form.register("passportNumber")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="passportExpiryDate">Passport Expiry Date</FieldLabel>
              <Input id="passportExpiryDate" type="date" {...form.register("passportExpiryDate")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="nationality">Nationality</FieldLabel>
              <Input id="nationality" {...form.register("nationality")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="dateOfBirth">Date of Birth</FieldLabel>
              <Input id="dateOfBirth" type="date" {...form.register("dateOfBirth")} />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Employment</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="designation">Designation</FieldLabel>
              <Input id="designation" {...form.register("designation")} placeholder="e.g. Scaffolder" />
            </Field>
            <Field>
              <FieldLabel htmlFor="skillCategory">Skill / Category</FieldLabel>
              <Input id="skillCategory" {...form.register("skillCategory")} />
            </Field>
            <Field>
              <FieldLabel>Status</FieldLabel>
              <Select
                value={form.watch("status")}
                onValueChange={(value) => form.setValue("status", value as WorkerFormInput["status"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORKER_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.replaceAll("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="joiningDate">Joining Date</FieldLabel>
              <Input id="joiningDate" type="date" {...form.register("joiningDate")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="mobilizationDate">Mobilization Date</FieldLabel>
              <Input id="mobilizationDate" type="date" {...form.register("mobilizationDate")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="demobilizationDate">Demobilization Date</FieldLabel>
              <Input id="demobilizationDate" type="date" {...form.register("demobilizationDate")} />
            </Field>
            <Field>
              <FieldLabel>Coordinator</FieldLabel>
              <Select
                value={form.watch("coordinatorId") || "NONE"}
                onValueChange={(value) => form.setValue("coordinatorId", value === "NONE" ? "" : (value ?? ""))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None</SelectItem>
                  {coordinators.map((coordinator) => (
                    <SelectItem key={coordinator.id} value={coordinator.id}>
                      {coordinator.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="hourlyRate">Hourly Rate (SAR)</FieldLabel>
              <Input id="hourlyRate" type="number" step="0.01" {...form.register("hourlyRate")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="overtimeRate">Overtime Rate (SAR)</FieldLabel>
              <Input id="overtimeRate" type="number" step="0.01" {...form.register("overtimeRate")} />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bank & Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="bankName">Bank Name</FieldLabel>
              <Input id="bankName" {...form.register("bankName")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="bankAccountIban">IBAN / Account Number</FieldLabel>
              <Input id="bankAccountIban" {...form.register("bankAccountIban")} />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="notes">Notes</FieldLabel>
              <Textarea id="notes" rows={3} {...form.register("notes")} />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {workerId ? "Save Changes" : "Create Worker"}
        </Button>
      </div>
    </form>
  );
}
