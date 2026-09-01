"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  COMMISSION_TYPES,
  commissionRuleFormSchema,
  type CommissionRuleFormInput,
  type CommissionRuleFormValues,
} from "@/lib/validation/coordinator-finance";
import { archiveCommissionRule, createCommissionRule } from "@/server/actions/coordinator-finance";

type Rule = { id: string; type: string; rateOrAmount: string; recurring: boolean; coordinator: { name: string } | null };
type Coordinator = { id: string; name: string };

const TYPE_LABELS: Record<(typeof COMMISSION_TYPES)[number], string> = {
  PERCENT_OF_SALES: "% of Sales",
  PERCENT_OF_INVOICE: "% of Invoice",
  PERCENT_OF_PROFIT: "% of Profit",
  PER_WORKER: "Per Worker",
  PER_HOUR: "Per Hour",
  FIXED_AMOUNT: "Fixed Amount",
};

export function CommissionRulesSection({ rules, coordinators }: { rules: Rule[]; coordinators: Coordinator[] }) {
  const router = useRouter();
  const defaults: CommissionRuleFormValues = { coordinatorId: "", type: "PERCENT_OF_SALES", rateOrAmount: 0, recurring: false };
  const form = useForm<CommissionRuleFormValues, unknown, CommissionRuleFormInput>({
    resolver: zodResolver(commissionRuleFormSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function onSubmit(values: CommissionRuleFormInput) {
    const result = await createCommissionRule(values);
    if (result.success) {
      toast.success("Commission rule added.");
      form.reset(defaults);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  function handleArchive(id: string) {
    setArchivingId(id);
    startTransition(async () => {
      const result = await archiveCommissionRule(id);
      if (result.success) {
        toast.success("Commission rule archived.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setArchivingId(null);
    });
  }

  const isPercent = form.watch("type").startsWith("PERCENT");

  return (
    <div className="space-y-4">
      {rules.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scope</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Rate/Amount</TableHead>
                <TableHead>Recurring</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>{rule.coordinator ? rule.coordinator.name : "Default (all coordinators)"}</TableCell>
                  <TableCell>{TYPE_LABELS[rule.type as (typeof COMMISSION_TYPES)[number]] ?? rule.type}</TableCell>
                  <TableCell>{rule.type.startsWith("PERCENT") ? `${rule.rateOrAmount}%` : `SAR ${rule.rateOrAmount}`}</TableCell>
                  <TableCell>{rule.recurring ? "Yes" : "No"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleArchive(rule.id)}
                      disabled={isPending && archivingId === rule.id}
                    >
                      {isPending && archivingId === rule.id ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
                      Archive
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Field>
            <FieldLabel>Coordinator</FieldLabel>
            <Select value={form.watch("coordinatorId") || "DEFAULT"} onValueChange={(v) => form.setValue("coordinatorId", v === "DEFAULT" ? "" : (v ?? ""))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DEFAULT">Default (all)</SelectItem>
                {coordinators.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Type</FieldLabel>
            <Select value={form.watch("type")} onValueChange={(v) => v && form.setValue("type", v as CommissionRuleFormInput["type"])}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMISSION_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="rateOrAmount">{isPercent ? "Percentage" : "Amount (SAR)"} *</FieldLabel>
            <Input id="rateOrAmount" type="number" step="0.01" {...form.register("rateOrAmount")} />
            {errors.rateOrAmount && <FieldError>{errors.rateOrAmount.message}</FieldError>}
          </Field>
          <Field orientation="horizontal" className="items-center">
            <Checkbox checked={form.watch("recurring")} onCheckedChange={(checked) => form.setValue("recurring", checked === true)} />
            <FieldLabel>Recurring</FieldLabel>
          </Field>
        </FieldGroup>
        <Button type="submit" disabled={isSubmitting} size="sm">
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          Add Rule
        </Button>
      </form>
    </div>
  );
}
