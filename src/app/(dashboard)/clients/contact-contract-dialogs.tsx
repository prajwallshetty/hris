"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import {
  clientContactFormSchema,
  clientContractFormSchema,
  type ClientContactFormInput,
  type ClientContractFormInput,
} from "@/lib/validation/client";
import { createClientContact, createClientContract } from "@/server/actions/clients";

export function AddContactDialog({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const form = useForm<ClientContactFormInput>({
    resolver: zodResolver(clientContactFormSchema),
    defaultValues: { clientId, name: "", designation: "", phone: "", email: "", isPrimary: false },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: ClientContactFormInput) {
    const result = await createClientContact(values);
    if (result.success) {
      toast.success("Contact added.");
      setOpen(false);
      form.reset({ clientId, name: "", designation: "", phone: "", email: "", isPrimary: false });
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Add Contact</Button>} />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Contact</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="contactName">Name *</FieldLabel>
              <Input id="contactName" {...form.register("name")} />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="contactDesignation">Designation</FieldLabel>
              <Input id="contactDesignation" {...form.register("designation")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="contactPhone">Phone</FieldLabel>
              <Input id="contactPhone" {...form.register("phone")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="contactEmail">Email</FieldLabel>
              <Input id="contactEmail" type="email" {...form.register("email")} />
              {errors.email && <FieldError>{errors.email.message}</FieldError>}
            </Field>
            <Field orientation="horizontal">
              <Checkbox
                checked={form.watch("isPrimary")}
                onCheckedChange={(checked) => form.setValue("isPrimary", checked)}
              />
              <FieldLabel>Primary contact</FieldLabel>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Add Contact
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddContractDialog({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const form = useForm<ClientContractFormInput>({
    resolver: zodResolver(clientContractFormSchema),
    defaultValues: { clientId, contractNumber: "", startDate: "", endDate: "", terms: "" },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: ClientContractFormInput) {
    const result = await createClientContract(values);
    if (result.success) {
      toast.success("Contract added.");
      setOpen(false);
      form.reset({ clientId, contractNumber: "", startDate: "", endDate: "", terms: "" });
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Add Contract</Button>} />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Contract</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="contractNumber">Contract Number</FieldLabel>
              <Input id="contractNumber" {...form.register("contractNumber")} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="contractStart">Start Date</FieldLabel>
                <Input id="contractStart" type="date" {...form.register("startDate")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="contractEnd">End Date</FieldLabel>
                <Input id="contractEnd" type="date" {...form.register("endDate")} />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="contractTerms">Terms</FieldLabel>
              <Textarea id="contractTerms" rows={3} {...form.register("terms")} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Add Contract
            </Button>
            {errors.root && <FieldError>{errors.root.message}</FieldError>}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
