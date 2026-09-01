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
  leaveRequestFormSchema,
  type LeaveRequestFormInput,
  type LeaveRequestFormValues,
} from "@/lib/validation/leave";
import { createLeaveRequest } from "@/server/actions/leave";

type LeaveType = { id: string; name: string };

export function LeaveRequestDialog({
  workerId,
  employeeId,
  leaveTypes,
}: {
  workerId?: string;
  employeeId?: string;
  leaveTypes: LeaveType[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const defaults: LeaveRequestFormValues = {
    workerId: workerId ?? "",
    employeeId: employeeId ?? "",
    leaveTypeId: "",
    startDate: "",
    endDate: "",
    days: 1,
    reason: "",
  };
  const form = useForm<LeaveRequestFormValues, unknown, LeaveRequestFormInput>({
    resolver: zodResolver(leaveRequestFormSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: LeaveRequestFormInput) {
    const result = await createLeaveRequest(values);
    if (result.success) {
      toast.success("Leave request submitted.");
      setOpen(false);
      form.reset(defaults);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Request Leave</Button>} />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Request Leave</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel>Leave Type *</FieldLabel>
              <Select value={form.watch("leaveTypeId")} onValueChange={(v) => form.setValue("leaveTypeId", v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.leaveTypeId && <FieldError>{errors.leaveTypeId.message}</FieldError>}
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="startDate">Start Date *</FieldLabel>
                <Input id="startDate" type="date" {...form.register("startDate")} />
                {errors.startDate && <FieldError>{errors.startDate.message}</FieldError>}
              </Field>
              <Field>
                <FieldLabel htmlFor="endDate">End Date *</FieldLabel>
                <Input id="endDate" type="date" {...form.register("endDate")} />
                {errors.endDate && <FieldError>{errors.endDate.message}</FieldError>}
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="days">Number of Days *</FieldLabel>
              <Input id="days" type="number" step="0.5" {...form.register("days")} />
              {errors.days && <FieldError>{errors.days.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="reason">Reason</FieldLabel>
              <Textarea id="reason" rows={2} {...form.register("reason")} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Submit Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
