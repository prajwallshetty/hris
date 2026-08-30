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
import { createCoordinator } from "@/server/actions/coordinators";

export function CoordinatorFormDialog({ trigger }: { trigger: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const form = useForm<CoordinatorFormInput>({
    resolver: zodResolver(coordinatorFormSchema),
    defaultValues: { name: "", phone: "", email: "" },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: CoordinatorFormInput) {
    const result = await createCoordinator(values);
    if (result.success) {
      toast.success("Coordinator added.");
      setOpen(false);
      form.reset();
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Coordinator</DialogTitle>
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
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
