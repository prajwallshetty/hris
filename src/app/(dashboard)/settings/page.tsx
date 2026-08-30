import { forbidden } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { can } from "@/server/rbac";
import { getActiveBillingRule, getActiveOvertimeRule, getSystemSettings } from "@/server/queries/settings";
import { getSessionUser } from "@/server/session";

import { BillingRuleForm, CurrencyForm, OvertimeRuleForm } from "./settings-forms";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!can(user, "view", "settings")) forbidden();

  const [overtimeRule, billingRule, systemSettings] = await Promise.all([
    getActiveOvertimeRule(),
    getActiveBillingRule(),
    getSystemSettings(),
  ]);

  const canEdit = can(user, "update", "settings");

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Settings"
        description="Calculation rules the app reads at runtime — not hardcoded in the code."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company</CardTitle>
          <CardDescription>Shown across the UI and on generated documents.</CardDescription>
        </CardHeader>
        <CardContent>
          {canEdit ? (
            <CurrencyForm defaultValues={systemSettings} />
          ) : (
            <p className="text-muted-foreground text-sm">
              {systemSettings.companyName} — {systemSettings.currencyCode}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Overtime Rule</CardTitle>
          <CardDescription>
            Drives the hours calculation engine — how daily hours split into regular vs. overtime.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canEdit ? (
            <OvertimeRuleForm
              defaultValues={{
                dailyRegularHoursThreshold: Number(overtimeRule.dailyRegularHoursThreshold),
                overtimeMultiplier: Number(overtimeRule.overtimeMultiplier),
                maxDailyHours: overtimeRule.maxDailyHours ? Number(overtimeRule.maxDailyHours) : undefined,
                minPayableHours: overtimeRule.minPayableHours ? Number(overtimeRule.minPayableHours) : undefined,
              }}
            />
          ) : (
            <p className="text-muted-foreground text-sm">
              {Number(overtimeRule.dailyRegularHoursThreshold)}h/day threshold, {Number(overtimeRule.overtimeMultiplier)}x
              multiplier.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Billing Rule</CardTitle>
          <CardDescription>Tax percentage applied when generating client invoices.</CardDescription>
        </CardHeader>
        <CardContent>
          {canEdit ? (
            <BillingRuleForm defaultValues={{ taxPercent: Number(billingRule.taxPercent) }} />
          ) : (
            <p className="text-muted-foreground text-sm">{Number(billingRule.taxPercent)}% tax</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
