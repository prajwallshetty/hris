"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  generateCommissionFromSaleFormSchema,
  type GenerateCommissionFromSaleFormInput,
  type GenerateCommissionFromSaleFormValues,
} from "@/lib/validation/coordinator-finance";
import { advanceCommissionStatus, generateCommissionFromSale } from "@/server/actions/coordinator-finance";

type SaleOption = { id: string; description: string | null; amount: string; date: string };
type RuleOption = { id: string; type: string; rateOrAmount: string; coordinatorId: string | null };

export function GenerateCommissionDialog({ sales, rules }: { sales: SaleOption[]; rules: RuleOption[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const eligibleRules = rules.filter((r) => r.type === "PERCENT_OF_SALES" || r.type === "FIXED_AMOUNT");
  const defaults: GenerateCommissionFromSaleFormValues = { saleId: "", commissionRuleId: "" };
  const form = useForm<GenerateCommissionFromSaleFormValues, unknown, GenerateCommissionFromSaleFormInput>({
    resolver: zodResolver(generateCommissionFromSaleFormSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;

  if (sales.length === 0) return null;

  async function onSubmit(values: GenerateCommissionFromSaleFormInput) {
    const result = await generateCommissionFromSale(values);
    if (result.success) {
      toast.success("Commission generated.");
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
          <Button size="sm" variant="outline">
            <Sparkles className="size-4" />
            Generate from Sale
          </Button>
        }
      />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Generate Commission</DialogTitle>
          <DialogDescription>Only percent-of-sales and fixed-amount rules can be generated this way.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel>Sale *</FieldLabel>
              <Select value={form.watch("saleId")} onValueChange={(v) => form.setValue("saleId", v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an un-commissioned sale" />
                </SelectTrigger>
                <SelectContent>
                  {sales.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.date} — SAR {s.amount} {s.description ? `(${s.description})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.saleId && <FieldError>{errors.saleId.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel>Commission Rule *</FieldLabel>
              <Select value={form.watch("commissionRuleId")} onValueChange={(v) => form.setValue("commissionRuleId", v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a rule" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleRules.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.type === "PERCENT_OF_SALES" ? `${r.rateOrAmount}% of sale` : `Fixed SAR ${r.rateOrAmount}`}
                      {r.coordinatorId ? " (coordinator-specific)" : " (default)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.commissionRuleId && <FieldError>{errors.commissionRuleId.message}</FieldError>}
              {eligibleRules.length === 0 && (
                <p className="text-muted-foreground text-xs">
                  No percent-of-sales or fixed-amount commission rule is configured yet — add one in Settings.
                </p>
              )}
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || eligibleRules.length === 0}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Generate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const NEXT_LABEL: Record<string, string> = {
  DRAFT: "Approve",
  APPROVED: "Mark Payable",
  PAYABLE: "Mark Paid",
};

export function AdvanceCommissionButton({ commissionId, status }: { commissionId: string; status: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const label = NEXT_LABEL[status];
  if (!label) return null;

  function handleClick() {
    startTransition(async () => {
      const result = await advanceCommissionStatus(commissionId);
      if (result.success) {
        toast.success(`Commission ${label.toLowerCase()}d.`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={handleClick} disabled={isPending}>
      {isPending ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
      {label}
    </Button>
  );
}
