"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { useMemo, useState } from "react";
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
import { EntityCombobox } from "@/components/shared/entity-combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  generateInvoiceFormSchema,
  type GenerateInvoiceFormInput,
  type GenerateInvoiceFormValues,
} from "@/lib/validation/invoice";
import { generateInvoice } from "@/server/actions/invoices";

type ClientTree = { id: string; companyName: string; projects: { id: string; name: string }[] };

export function GenerateInvoiceDialog({ clients, presetClientId }: { clients: ClientTree[]; presetClientId?: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const defaults: GenerateInvoiceFormValues = {
    clientId: presetClientId ?? "",
    projectId: "",
    billingPeriodStart: "",
    billingPeriodEnd: "",
  };
  const form = useForm<GenerateInvoiceFormValues, unknown, GenerateInvoiceFormInput>({
    resolver: zodResolver(generateInvoiceFormSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;
  const clientId = form.watch("clientId");
  const projects = useMemo(() => clients.find((c) => c.id === clientId)?.projects ?? [], [clients, clientId]);

  async function onSubmit(values: GenerateInvoiceFormInput) {
    const result = await generateInvoice(values);
    if (result.success) {
      toast.success("Invoice generated.");
      setOpen(false);
      form.reset(defaults);
      router.push(`/invoices/${result.data.id}`);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus className="size-4" />
            Generate Invoice
          </Button>
        }
      />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Generate Invoice</DialogTitle>
          <DialogDescription>Bills approved hours from Locked timesheets at the client rate on each assignment.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            {!presetClientId && (
              <Field>
                <FieldLabel>Client *</FieldLabel>
                <EntityCombobox
                  entityType="client"
                  value={form.watch("clientId")}
                  onChange={(v) => {
                    form.setValue("clientId", v);
                    form.setValue("projectId", "");
                  }}
                  placeholder="Select Client"
                  error={errors.clientId?.message}
                  required
                />
                {errors.clientId && <FieldError>{errors.clientId.message}</FieldError>}
              </Field>
            )}
            <Field>
              <FieldLabel>Project (optional)</FieldLabel>
              <EntityCombobox
                entityType="project"
                value={form.watch("projectId")}
                parentValue={clientId}
                disabled={!clientId}
                onChange={(v) => form.setValue("projectId", v)}
                placeholder={clientId ? "All projects (Optional)" : "Select client first"}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="billingPeriodStart">Start Date *</FieldLabel>
                <Input id="billingPeriodStart" type="date" {...form.register("billingPeriodStart")} />
                {errors.billingPeriodStart && <FieldError>{errors.billingPeriodStart.message}</FieldError>}
              </Field>
              <Field>
                <FieldLabel htmlFor="billingPeriodEnd">End Date *</FieldLabel>
                <Input id="billingPeriodEnd" type="date" {...form.register("billingPeriodEnd")} />
                {errors.billingPeriodEnd && <FieldError>{errors.billingPeriodEnd.message}</FieldError>}
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Generate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
