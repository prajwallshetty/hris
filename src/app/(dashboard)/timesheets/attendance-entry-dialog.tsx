"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MoonStar } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";

import { EntityCombobox } from "@/components/shared/entity-combobox";
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
  ATTENDANCE_LEGEND_ORDER,
  ATTENDANCE_TONES,
  LEAVE_CATEGORIES,
  LEAVE_CATEGORY_LABELS,
  STATUSES_ALLOWING_TIMES,
  STATUSES_REQUIRING_TIMES,
  type LeaveCategory,
  type WorkerAttendanceStatusValue,
} from "@/lib/attendance";
import { cn } from "@/lib/utils";
import { manualTimesheetItemFormSchema, timesheetItemUpdateSchema } from "@/lib/validation/timesheet";
import { buildAttendanceDayPreview, type AttendancePreviewRule } from "@/app/(dashboard)/timesheets/attendance-preview";
import { createManualTimesheetItem, updateTimesheetItem } from "@/server/actions/timesheets";

type FormValues = {
  workerId: string;
  siteId: string;
  date: string;
  attendanceStatus: WorkerAttendanceStatusValue;
  loginTime: string;
  logoutTime: string;
  breakMinutes?: number | string;
  halfDayLeave: LeaveCategory | "";
  otherLeaveTypeId: string;
  remarks: string;
  reason: string;
};

export type AttendanceEditTarget = {
  itemId: string;
  workerName: string;
  dateLabel: string;
  attendanceStatus: WorkerAttendanceStatusValue;
  loginTime: string;
  logoutTime: string;
  breakMinutes: number;
  halfDayLeave: LeaveCategory | "";
  otherLeaveTypeId: string;
  remarks: string;
};

/**
 * Records or corrects one worker-day (§ attendance). Create mode picks the
 * site and worker; edit mode corrects an existing day and requires a reason,
 * which is written to the audit log. The breakdown panel previews exactly how
 * the day will be stored: worked hours, break, overtime and each leave
 * category in its own line.
 */
export function AttendanceEntryDialog({
  trigger,
  leaveTypes,
  rule,
  edit,
}: {
  trigger: React.ReactElement;
  leaveTypes: { id: string; name: string }[];
  rule: AttendancePreviewRule;
  edit?: AttendanceEditTarget;
}) {
  const isEdit = Boolean(edit);
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const router = useRouter();

  const defaults: FormValues = {
    workerId: "",
    siteId: "",
    date: new Date().toISOString().slice(0, 10),
    attendanceStatus: edit?.attendanceStatus ?? "PRESENT",
    loginTime: edit ? edit.loginTime : "08:00",
    logoutTime: edit ? edit.logoutTime : "17:00",
    breakMinutes: edit ? edit.breakMinutes : 60,
    halfDayLeave: edit?.halfDayLeave ?? "",
    otherLeaveTypeId: edit?.otherLeaveTypeId ?? "",
    remarks: edit?.remarks ?? "",
    reason: "",
  };

  const form = useForm<FormValues>({
    resolver: (isEdit ? zodResolver(timesheetItemUpdateSchema.omit({ itemId: true })) : zodResolver(manualTimesheetItemFormSchema)) as unknown as Resolver<FormValues>,
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;

  const status = form.watch("attendanceStatus");
  const halfDayLeave = form.watch("halfDayLeave");
  const loginTime = form.watch("loginTime");
  const logoutTime = form.watch("logoutTime");
  const breakMinutes = form.watch("breakMinutes");
  const timesAllowed = STATUSES_ALLOWING_TIMES.includes(status);
  const timesRequired = STATUSES_REQUIRING_TIMES.includes(status);
  const needsLeaveType = status === "OTHER_LEAVE" || (status === "HALF_DAY" && halfDayLeave === "OTHER");

  const preview = buildAttendanceDayPreview(
    {
      status,
      loginTime: timesAllowed ? loginTime : "",
      logoutTime: timesAllowed ? logoutTime : "",
      breakMinutes: Number(breakMinutes) || 0,
      halfDayLeave: halfDayLeave || null,
      otherLeaveTypeId: needsLeaveType ? form.watch("otherLeaveTypeId") || "selected" : null,
    },
    rule,
  );

  function changeStatus(next: WorkerAttendanceStatusValue) {
    form.setValue("attendanceStatus", next);
    // Leave, absent, holiday and rest days start with no times — a holiday or
    // rest day only gets times if the worker actually worked, entered by hand.
    if (!STATUSES_REQUIRING_TIMES.includes(next)) {
      form.setValue("loginTime", "");
      form.setValue("logoutTime", "");
      form.setValue("breakMinutes", 0);
    } else if (STATUSES_REQUIRING_TIMES.includes(next) && !form.getValues("loginTime")) {
      form.setValue("loginTime", "08:00");
      form.setValue("logoutTime", next === "HALF_DAY" ? "12:00" : "17:00");
      form.setValue("breakMinutes", next === "HALF_DAY" ? 0 : 60);
    }
    if (next === "HALF_DAY" && !form.getValues("halfDayLeave")) form.setValue("halfDayLeave", "UNPAID");
  }

  async function onSubmit(values: FormValues) {
    const fields = {
      attendanceStatus: values.attendanceStatus,
      loginTime: timesAllowed ? values.loginTime : "",
      logoutTime: timesAllowed ? values.logoutTime : "",
      breakMinutes: timesAllowed ? Number(values.breakMinutes) || 0 : 0,
      halfDayLeave: values.attendanceStatus === "HALF_DAY" ? values.halfDayLeave : ("" as const),
      otherLeaveTypeId: needsLeaveType ? values.otherLeaveTypeId : "",
      remarks: values.remarks,
    };
    const result = edit
      ? await updateTimesheetItem({ itemId: edit.itemId, ...fields, reason: values.reason })
      : await createManualTimesheetItem({ workerId: values.workerId, siteId: values.siteId, date: values.date, ...fields });

    if (result.success) {
      toast.success(edit ? "Attendance corrected — the change is in the audit log." : "Attendance recorded.");
      setOpen(false);
      form.reset(defaults);
      setClientId("");
      setProjectId("");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-navy">{edit ? "Correct Attendance" : "Record Attendance"}</DialogTitle>
          <DialogDescription>
            {edit
              ? `${edit.workerName} · ${edit.dateLabel}. Corrections are audited and send the entry back for review.`
              : "One day for one worker. Worked hours, break and each leave type are stored separately."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit, (invalid) => {
            const first = Object.values(invalid).find((e) => e?.message)?.message;
            toast.error(typeof first === "string" ? first : "Check the highlighted fields.");
          })}
          className="space-y-4"
        >
          <FieldGroup className="grid grid-cols-1 gap-4">
            {!edit && (
              <>
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
                      onChange={(v) => form.setValue("siteId", v, { shouldValidate: form.formState.isSubmitted })}
                      placeholder={projectId ? "Select Site" : "Select project first"}
                      error={errors.siteId?.message}
                      required
                    />
                    {errors.siteId && <FieldError>{errors.siteId.message}</FieldError>}
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_11rem]">
                  <Field>
                    <FieldLabel>Worker *</FieldLabel>
                    <EntityCombobox
                      entityType="worker"
                      value={form.watch("workerId")}
                      onChange={(v) => form.setValue("workerId", v, { shouldValidate: form.formState.isSubmitted })}
                      placeholder="Search worker by name or Iqama..."
                      error={errors.workerId?.message}
                      required
                    />
                    {errors.workerId && <FieldError>{errors.workerId.message}</FieldError>}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="date">Date *</FieldLabel>
                    <Input id="date" type="date" {...form.register("date")} />
                    {errors.date && <FieldError>{errors.date.message}</FieldError>}
                  </Field>
                </div>
              </>
            )}

            <Field>
              <FieldLabel>Attendance Status *</FieldLabel>
              <Select value={status} onValueChange={(v) => v && changeStatus(v as WorkerAttendanceStatusValue)}>
                <SelectTrigger className="w-full" aria-label="Attendance status">
                  <SelectValue format={(v) => ATTENDANCE_TONES[v as WorkerAttendanceStatusValue].label} />
                </SelectTrigger>
                <SelectContent>
                  {ATTENDANCE_LEGEND_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      <span className={cn("size-2 rounded-full", ATTENDANCE_TONES[s].dot)} aria-hidden />
                      {ATTENDANCE_TONES[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {status === "HALF_DAY" && (
              <Field>
                <FieldLabel>Other half of the day *</FieldLabel>
                <Select value={halfDayLeave} onValueChange={(v) => v && form.setValue("halfDayLeave", v as LeaveCategory)}>
                  <SelectTrigger className="w-full" aria-label="Other half of the day">
                    <SelectValue format={(v) => LEAVE_CATEGORY_LABELS[v as LeaveCategory]} placeholder="Choose leave" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAVE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {LEAVE_CATEGORY_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            {needsLeaveType && (
              <Field>
                <FieldLabel>Leave Type *</FieldLabel>
                <Select
                  value={form.watch("otherLeaveTypeId")}
                  onValueChange={(v) => v && form.setValue("otherLeaveTypeId", v)}
                  items={leaveTypes.map((t) => ({ value: t.id, label: t.name }))}
                >
                  <SelectTrigger className="w-full" aria-label="Leave type">
                    <SelectValue placeholder={leaveTypes.length ? "Choose an approved leave type" : "No leave types set up"} />
                  </SelectTrigger>
                  <SelectContent>
                    {leaveTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            {timesAllowed && (
              <div className="space-y-2">
                {!timesRequired && (
                  <p className="text-muted-foreground text-xs">
                    Only if the worker still worked on this {status === "WEEKLY_OFF" ? "rest day" : "holiday"} — leave blank otherwise.
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field>
                    <FieldLabel htmlFor="loginTime">Check-in{timesRequired && " *"}</FieldLabel>
                    <Input id="loginTime" type="time" {...form.register("loginTime")} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="logoutTime">Check-out{timesRequired && " *"}</FieldLabel>
                    <Input id="logoutTime" type="time" {...form.register("logoutTime")} />
                  </Field>
                  <Field className="col-span-2 sm:col-span-1">
                    <FieldLabel htmlFor="breakMinutes">Break (min)</FieldLabel>
                    <Input id="breakMinutes" type="number" min={0} step={5} {...form.register("breakMinutes")} />
                  </Field>
                </div>
                {preview.ok && preview.overnight && (
                  <p className="flex items-center gap-1.5 text-xs font-medium text-indigo-700">
                    <MoonStar className="size-3.5" /> Overnight shift — check-out is on the next day.
                  </p>
                )}
              </div>
            )}

            <AttendanceBreakdown preview={preview} />

            <Field>
              <FieldLabel htmlFor="remarks">Remarks</FieldLabel>
              <Textarea id="remarks" rows={2} placeholder="Optional note shown on the timesheet" {...form.register("remarks")} />
            </Field>

            {edit && (
              <Field>
                <FieldLabel htmlFor="reason">Reason for correction *</FieldLabel>
                <Textarea id="reason" rows={2} placeholder="e.g. Supervisor confirmed sick note" {...form.register("reason")} />
                {errors.reason && <FieldError>{errors.reason.message}</FieldError>}
              </Field>
            )}
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !preview.ok}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {edit ? "Save Correction" : "Record Attendance"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AttendanceBreakdown({ preview }: { preview: ReturnType<typeof buildAttendanceDayPreview> }) {
  if (!preview.ok) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {preview.errors.join(" ")}
      </div>
    );
  }
  const rows = preview.rows.filter((r) => r.always || r.value > 0);
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
      <p className="mb-2 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">How this day is recorded</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-2">
            <dt className="text-slate-600">{r.label}</dt>
            <dd className={cn("font-semibold tabular-nums", r.className)}>{r.value.toFixed(2)}h</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
