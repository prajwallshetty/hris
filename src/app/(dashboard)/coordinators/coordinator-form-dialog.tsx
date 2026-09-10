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
import { coordinatorFormSchema, type CoordinatorFormInput } from "@/lib/validation/coordinator";
import { createCoordinator, updateCoordinator } from "@/server/actions/coordinators";

export function CoordinatorFormDialog({
  trigger,
  coordinatorId,
  defaultValues,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  trigger?: React.ReactElement;
  coordinatorId?: string;
  defaultValues?: CoordinatorFormInput;
  /** Pass these to drive the dialog from outside (e.g. a "…" row menu) —
   * omit them and the dialog manages its own open state via `trigger`. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChangeProp ?? setInternalOpen;
  const router = useRouter();
  const form = useForm<CoordinatorFormInput>({
    resolver: zodResolver(coordinatorFormSchema),
    defaultValues: defaultValues ?? { name: "", phone: "", email: "" },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: CoordinatorFormInput) {
    const result = coordinatorId ? await updateCoordinator(coordinatorId, values) : await createCoordinator(values);
    if (result.success) {
      toast.success(coordinatorId ? "Coordinator updated." : "Coordinator added.");
      setOpen(false);
      if (!coordinatorId) form.reset();
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{coordinatorId ? "Edit Coordinator" : "Add Coordinator"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Name *</FieldLabel>
              <Input id="name" {...form.register("name")} />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="phone">Phone</FieldLabel>
              <Input id="phone" {...form.register("phone")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" type="email" {...form.register("email")} />
              {errors.email && <FieldError>{errors.email.message}</FieldError>}
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {coordinatorId ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
