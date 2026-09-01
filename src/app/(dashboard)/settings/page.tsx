import { forbidden } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { can } from "@/server/rbac";
import { listAllCommissionRules, listCoordinators } from "@/server/queries/coordinators";
import { getActiveBillingRule, getActiveOvertimeRule, getSystemSettings } from "@/server/queries/settings";
import { getSessionUser } from "@/server/session";

import { CommissionRulesSection } from "./commission-rules";
import { BillingRuleForm, CurrencyForm, OvertimeRuleForm } from "./settings-forms";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!can(user, "view", "settings")) forbidden();

  const canEdit = can(user, "update", "settings");

  const [overtimeRule, billingRule, systemSettings, commissionRules, coordinators] = await Promise.all([
    getActiveOvertimeRule(),
    getActiveBillingRule(),
    getSystemSettings(),
    canEdit ? listAllCommissionRules() : Promise.resolve([]),
    canEdit ? listCoordinators(user) : Promise.resolve([]),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Administration" }, { label: "Settings" }]}
        title="Settings"
        description="Calculation rules the app reads at runtime — not hardcoded in the code."
      />

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="payroll">Payroll Rules</TabsTrigger>
          <TabsTrigger value="billing">Billing Rules</TabsTrigger>
          {canEdit && <TabsTrigger value="commission">Commission Rules</TabsTrigger>}
        </TabsList>

        <TabsContent value="general">
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
        </TabsContent>

        <TabsContent value="payroll">
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
        </TabsContent>

        <TabsContent value="billing">
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
        </TabsContent>

        {canEdit && (
          <TabsContent value="commission">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Commission Rules</CardTitle>
                <CardDescription>
                  Configurable per coordinator or as a company-wide default — never a single hardcoded formula.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CommissionRulesSection
                  rules={commissionRules.map((r) => ({
                    id: r.id,
                    type: r.type,
                    rateOrAmount: r.rateOrAmount.toString(),
                    recurring: r.recurring,
                    coordinator: r.coordinator ? { name: r.coordinator.name } : null,
                  }))}
                  coordinators={coordinators.map((c) => ({ id: c.id, name: c.name }))}
                />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
