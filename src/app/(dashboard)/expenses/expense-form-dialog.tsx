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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EntityCombobox } from "@/components/shared/entity-combobox";
import {
  EXPENSE_CATEGORIES,
  expenseFormSchema,
  type ExpenseFormInput,
  type ExpenseFormValues,
} from "@/lib/validation/expense";
import { createExpense, updateExpense } from "@/server/actions/expenses";

type ClientTree = { id: string; companyName: string; projects: { id: string; name: string; sites: { id: string; name: string }[] }[] };
type WorkerOption = { id: string; fullName: string };
type Coordinator = { id: string; name: string };

export function ExpenseFormDialog({
  clients,
  workers,
  coordinators,
  expenseId,
  defaultValues,
  trigger,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  clients: ClientTree[];
  workers: WorkerOption[];
  coordinators: Coordinator[];
  expenseId?: string;
  defaultValues?: ExpenseFormValues;
  trigger?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChangeProp ?? setInternalOpen;
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const defaults: ExpenseFormValues = defaultValues ?? {
    category: "OTHER",
    amount: 0,
    date: today,
    description: "",
    workerId: "",
    clientId: "",
    siteId: "",
    coordinatorId: "",
    department: "",
  };
  const form = useForm<ExpenseFormValues, unknown, ExpenseFormInput>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;
  const clientId = form.watch("clientId");
  const sites = useMemo(() => clients.find((c) => c.id === clientId)?.projects.flatMap((p) => p.sites) ?? [], [clients, clientId]);

  async function onSubmit(values: ExpenseFormInput) {
    const result = expenseId ? await updateExpense(expenseId, values) : await createExpense(values);
    if (result.success) {
      toast.success(expenseId ? "Expense updated." : "Expense recorded.");
      setOpen(false);
      if (!expenseId) form.reset(defaults);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger render={trigger} />}
      {!trigger && !expenseId && (
        <DialogTrigger
          render={
            <Button>
              <Plus className="size-4" />
              Add Expense
            </Button>
          }
        />
      )}
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{expenseId ? "Edit Expense" : "Add Expense"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Category *</FieldLabel>
              <Select value={form.watch("category")} onValueChange={(v) => v && form.setValue("category", v as ExpenseFormInput["category"])}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c.replaceAll("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="amount">Amount (SAR) *</FieldLabel>
              <Input id="amount" type="number" step="0.01" {...form.register("amount")} />
              {errors.amount && <FieldError>{errors.amount.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="date">Date *</FieldLabel>
              <Input id="date" type="date" {...form.register("date")} />
              {errors.date && <FieldError>{errors.date.message}</FieldError>}
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Textarea id="description" rows={2} {...form.register("description")} />
            </Field>

            <Field>
              <FieldLabel>Client</FieldLabel>
              <EntityCombobox
                entityType="client"
                value={form.watch("clientId")}
                onChange={(v) => {
                  form.setValue("clientId", v);
                  form.setValue("siteId", "");
                }}
                placeholder="Select Client (Optional)"
              />
            </Field>
            <Field>
              <FieldLabel>Site</FieldLabel>
              <EntityCombobox
                entityType="site"
                value={form.watch("siteId")}
                parentValue={clientId}
                disabled={!clientId}
                onChange={(v) => form.setValue("siteId", v)}
                placeholder={clientId ? "Select Site (Optional)" : "Select client first"}
              />
            </Field>
            <Field>
              <FieldLabel>Worker</FieldLabel>
              <EntityCombobox
                entityType="worker"
                value={form.watch("workerId")}
                onChange={(v) => form.setValue("workerId", v)}
                placeholder="Select Worker (Optional)"
              />
            </Field>
            <Field>
              <FieldLabel>Coordinator</FieldLabel>
              <EntityCombobox
                entityType="coordinator"
                value={form.watch("coordinatorId")}
                onChange={(v) => form.setValue("coordinatorId", v)}
                placeholder="Select Coordinator (Optional)"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="department">Department</FieldLabel>
              <Input id="department" {...form.register("department")} placeholder="e.g. Operations" />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {expenseId ? "Save Changes" : "Add Expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
