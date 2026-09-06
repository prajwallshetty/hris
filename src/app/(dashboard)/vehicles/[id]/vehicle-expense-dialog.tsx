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
  VEHICLE_EXPENSE_CATEGORIES,
  vehicleExpenseFormSchema,
  type VehicleExpenseFormInput,
  type VehicleExpenseFormValues,
} from "@/lib/validation/vehicle";
import { recordVehicleExpense } from "@/server/actions/vehicles";

export function VehicleExpenseDialog({ vehicleId }: { vehicleId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const defaults: VehicleExpenseFormValues = {
    vehicleId,
    category: "FUEL",
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    workerId: "",
    coordinatorId: "",
    clientId: "",
    projectId: "",
    siteId: "",
    receiptUrl: "",
    description: "",
  };

  const form = useForm<VehicleExpenseFormValues, unknown, VehicleExpenseFormInput>({
    resolver: zodResolver(vehicleExpenseFormSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: VehicleExpenseFormInput) {
    const result = await recordVehicleExpense(values);
    if (result.success) {
      toast.success("Expense recorded.");
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
            Record Expense
          </Button>
        }
      />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Record Vehicle Expense</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Category *</FieldLabel>
                <Select
                  value={form.watch("category")}
                  onValueChange={(v) => v && form.setValue("category", v as VehicleExpenseFormInput["category"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VEHICLE_EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
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
            </div>
            <Field>
              <FieldLabel htmlFor="date">Date *</FieldLabel>
              <Input id="date" type="date" {...form.register("date")} />
              {errors.date && <FieldError>{errors.date.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Textarea id="description" rows={2} {...form.register("description")} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Record Expense
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
