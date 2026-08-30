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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { clientFormSchema, type ClientFormInput } from "@/lib/validation/client";
import { createClient, updateClient } from "@/server/actions/clients";

export function ClientFormDialog({
  trigger,
  clientId,
  defaultValues,
}: {
  trigger: React.ReactElement;
  clientId?: string;
  defaultValues?: Partial<ClientFormInput>;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const form = useForm<ClientFormInput>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      companyName: "",
      contactPerson: "",
      phone: "",
      email: "",
      address: "",
      contractRef: "",
      paymentTerms: "",
      billingTerms: "",
      status: "ACTIVE",
      ...defaultValues,
    },
  });

  async function onSubmit(values: ClientFormInput) {
    const result = clientId ? await updateClient(clientId, values) : await createClient(values);
    if (result.success) {
      toast.success(clientId ? "Client updated." : "Client created.");
      setOpen(false);
      form.reset();
      router.push(`/clients/${result.data.id}`);
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
          <DialogTitle>{clientId ? "Edit Client" : "Add Client"}</DialogTitle>
          <DialogDescription>Company-level record. Projects and sites are managed below.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="companyName">Company Name *</FieldLabel>
              <Input id="companyName" {...form.register("companyName")} />
              {errors.companyName && <FieldError>{errors.companyName.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="contactPerson">Contact Person</FieldLabel>
              <Input id="contactPerson" {...form.register("contactPerson")} />
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
            <Field>
              <FieldLabel htmlFor="contractRef">Contract Reference</FieldLabel>
              <Input id="contractRef" {...form.register("contractRef")} />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="address">Address</FieldLabel>
              <Textarea id="address" rows={2} {...form.register("address")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="paymentTerms">Payment Terms</FieldLabel>
              <Input id="paymentTerms" {...form.register("paymentTerms")} placeholder="e.g. Net 30" />
            </Field>
            <Field>
              <FieldLabel htmlFor="billingTerms">Billing Terms</FieldLabel>
              <Input id="billingTerms" {...form.register("billingTerms")} placeholder="e.g. Monthly" />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {clientId ? "Save Changes" : "Create Client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
