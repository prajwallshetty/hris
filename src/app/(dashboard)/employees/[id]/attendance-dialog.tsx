"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
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
  attendanceFormSchema,
  type AttendanceFormInput,
  type AttendanceFormValues,
} from "@/lib/validation/employee";
import { recordAttendance } from "@/server/actions/employees";

const STATUSES = ["PRESENT", "ABSENT", "HALF_DAY", "ON_LEAVE", "HOLIDAY"] as const;

export function AttendanceDialog({ employeeId }: { employeeId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const defaults: AttendanceFormValues = {
    employeeId,
    date: today,
    status: "PRESENT",
    checkIn: "",
    checkOut: "",
    remarks: "",
  };
  const form = useForm<AttendanceFormValues, unknown, AttendanceFormInput>({
    resolver: zodResolver(attendanceFormSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: AttendanceFormInput) {
    const result = await recordAttendance(values);
    if (result.success) {
      toast.success("Attendance recorded.");
      setOpen(false);
      form.reset(defaults);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="size-4" />
            Record Attendance
          </Button>
        }
      />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Record Attendance</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="date">Date *</FieldLabel>
              <Input id="date" type="date" {...form.register("date")} />
              {errors.date && <FieldError>{errors.date.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel>Status</FieldLabel>
              <Select value={form.watch("status")} onValueChange={(v) => v && form.setValue("status", v as AttendanceFormInput["status"])}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replaceAll("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="checkIn">Check In</FieldLabel>
                <Input id="checkIn" type="time" {...form.register("checkIn")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="checkOut">Check Out</FieldLabel>
                <Input id="checkOut" type="time" {...form.register("checkOut")} />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="remarks">Remarks</FieldLabel>
              <Textarea id="remarks" rows={2} {...form.register("remarks")} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
