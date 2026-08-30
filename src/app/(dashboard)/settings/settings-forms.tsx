"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  billingRuleFormSchema,
  currencySettingFormSchema,
  overtimeRuleFormSchema,
  type BillingRuleFormInput,
  type BillingRuleFormValues,
  type CurrencySettingFormInput,
  type OvertimeRuleFormInput,
  type OvertimeRuleFormValues,
} from "@/lib/validation/settings";
import { updateBillingRule, updateCurrencySettings, updateOvertimeRule } from "@/server/actions/settings";

export function OvertimeRuleForm({ defaultValues }: { defaultValues: OvertimeRuleFormInput }) {
  const router = useRouter();
  const form = useForm<OvertimeRuleFormValues, unknown, OvertimeRuleFormInput>({
    resolver: zodResolver(overtimeRuleFormSchema),
    defaultValues,
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: OvertimeRuleFormInput) {
    const result = await updateOvertimeRule(values);
    if (result.success) {
      toast.success("Overtime rule updated.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="dailyRegularHoursThreshold">Daily regular hours threshold</FieldLabel>
          <Input id="dailyRegularHoursThreshold" type="number" step="0.5" {...form.register("dailyRegularHoursThreshold")} />
          {errors.dailyRegularHoursThreshold && <FieldError>{errors.dailyRegularHoursThreshold.message}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="overtimeMultiplier">Overtime multiplier</FieldLabel>
          <Input id="overtimeMultiplier" type="number" step="0.1" {...form.register("overtimeMultiplier")} />
          {errors.overtimeMultiplier && <FieldError>{errors.overtimeMultiplier.message}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="maxDailyHours">Max daily hours (optional)</FieldLabel>
          <Input id="maxDailyHours" type="number" step="0.5" {...form.register("maxDailyHours")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="minPayableHours">Min payable hours (optional)</FieldLabel>
          <Input id="minPayableHours" type="number" step="0.5" {...form.register("minPayableHours")} />
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={isSubmitting} size="sm">
        {isSubmitting && <Loader2 className="size-4 animate-spin" />}
        Save
      </Button>
    </form>
  );
}

export function BillingRuleForm({ defaultValues }: { defaultValues: BillingRuleFormInput }) {
  const router = useRouter();
  const form = useForm<BillingRuleFormValues, unknown, BillingRuleFormInput>({
    resolver: zodResolver(billingRuleFormSchema),
    defaultValues,
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: BillingRuleFormInput) {
    const result = await updateBillingRule(values);
    if (result.success) {
      toast.success("Billing rule updated.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <FieldGroup className="max-w-xs">
        <Field>
          <FieldLabel htmlFor="taxPercent">Tax percentage applied to invoices</FieldLabel>
          <Input id="taxPercent" type="number" step="0.1" {...form.register("taxPercent")} />
          {errors.taxPercent && <FieldError>{errors.taxPercent.message}</FieldError>}
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={isSubmitting} size="sm">
        {isSubmitting && <Loader2 className="size-4 animate-spin" />}
        Save
      </Button>
    </form>
  );
}

export function CurrencyForm({ defaultValues }: { defaultValues: CurrencySettingFormInput }) {
  const router = useRouter();
  const form = useForm<CurrencySettingFormInput>({ resolver: zodResolver(currencySettingFormSchema), defaultValues });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: CurrencySettingFormInput) {
    const result = await updateCurrencySettings(values);
    if (result.success) {
      toast.success("Settings updated.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="companyName">Company name</FieldLabel>
          <Input id="companyName" {...form.register("companyName")} />
          {errors.companyName && <FieldError>{errors.companyName.message}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="currencyCode">Currency code</FieldLabel>
          <Input id="currencyCode" maxLength={3} {...form.register("currencyCode")} />
          {errors.currencyCode && <FieldError>{errors.currencyCode.message}</FieldError>}
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={isSubmitting} size="sm">
        {isSubmitting && <Loader2 className="size-4 animate-spin" />}
        Save
      </Button>
    </form>
  );
}
