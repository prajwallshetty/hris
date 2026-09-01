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
  EMPLOYEE_STATUSES,
  employeeFormSchema,
  type EmployeeFormInput,
  type EmployeeFormValues,
} from "@/lib/validation/employee";
import { createEmployee, updateEmployee } from "@/server/actions/employees";

type Coordinator = { id: string; name: string };

export function EmployeeForm({
  employeeId,
  defaultValues,
  coordinators,
}: {
  employeeId?: string;
  defaultValues?: Partial<EmployeeFormValues>;
  coordinators: Coordinator[];
}) {
  const router = useRouter();
  const form = useForm<EmployeeFormValues, unknown, EmployeeFormInput>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      department: "",
      designation: "",
      joiningDate: "",
      coordinatorId: "",
      baseSalary: 0,
      status: "ACTIVE",
      bankName: "",
      bankAccountIban: "",
      notes: "",
      ...defaultValues,
    },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: EmployeeFormInput) {
    const result = employeeId ? await updateEmployee(employeeId, values) : await createEmployee(values);
    if (result.success) {
      toast.success(employeeId ? "Employee updated." : "Employee created.");
      router.push(`/employees/${result.data.id}`);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identity</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="fullName">Full Name *</FieldLabel>
              <Input id="fullName" {...form.register("fullName")} />
              {errors.fullName && <FieldError>{errors.fullName.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" type="email" {...form.register("email")} />
              {errors.email && <FieldError>{errors.email.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="phone">Phone</FieldLabel>
              <Input id="phone" {...form.register("phone")} />
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
              <FieldLabel htmlFor="department">Department</FieldLabel>
              <Input id="department" {...form.register("department")} placeholder="e.g. Operations" />
            </Field>
            <Field>
              <FieldLabel htmlFor="designation">Designation</FieldLabel>
              <Input id="designation" {...form.register("designation")} placeholder="e.g. HR Officer" />
            </Field>
            <Field>
              <FieldLabel>Status</FieldLabel>
              <Select value={form.watch("status")} onValueChange={(value) => form.setValue("status", value as EmployeeFormInput["status"])}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYEE_STATUSES.map((status) => (
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
              <FieldLabel htmlFor="baseSalary">Base Salary (SAR/month) *</FieldLabel>
              <Input id="baseSalary" type="number" step="0.01" {...form.register("baseSalary")} />
              {errors.baseSalary && <FieldError>{errors.baseSalary.message}</FieldError>}
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
          {employeeId ? "Save Changes" : "Create Employee"}
        </Button>
      </div>
    </form>
  );
}
