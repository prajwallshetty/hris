"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  assignmentEditFormSchema,
  type AssignmentEditFormInput,
  type AssignmentEditFormValues,
} from "@/lib/validation/assignment";
import { updateAssignment } from "@/server/actions/assignments";

type Coordinator = { id: string; name: string };

/** Corrects rates/designation/coordinator/notes on the worker's CURRENT
 * active assignment only — worker/client/site/dates define which
 * assignment this is, so those go through end + create instead, never an
 * in-place edit (§ never overwrite history). */
export function EditAssignmentDialog({
  assignmentId,
  coordinators,
  defaultValues,
}: {
  assignmentId: string;
  coordinators: Coordinator[];
  defaultValues: AssignmentEditFormValues;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const form = useForm<AssignmentEditFormValues, unknown, AssignmentEditFormInput>({
    resolver: zodResolver(assignmentEditFormSchema),
    defaultValues,
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: AssignmentEditFormInput) {
    const result = await updateAssignment(assignmentId, values);
    if (result.success) {
      toast.success("Assignment updated.");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm"><Pencil className="size-4" />Edit</Button>} />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Assignment</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="designation">Designation</FieldLabel>
              <Input id="designation" {...form.register("designation")} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="workerHourlyRate">Worker Rate (SAR/hr) *</FieldLabel>
                <Input id="workerHourlyRate" type="number" step="0.01" {...form.register("workerHourlyRate")} />
                {errors.workerHourlyRate && <FieldError>{errors.workerHourlyRate.message}</FieldError>}
              </Field>
              <Field>
                <FieldLabel htmlFor="clientBillingRate">Client Rate (SAR/hr) *</FieldLabel>
                <Input id="clientBillingRate" type="number" step="0.01" {...form.register("clientBillingRate")} />
                {errors.clientBillingRate && <FieldError>{errors.clientBillingRate.message}</FieldError>}
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
            <Field>
              <FieldLabel htmlFor="notes">Notes</FieldLabel>
              <Textarea id="notes" rows={2} {...form.register("notes")} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
