"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  CheckCircle2,
  ChevronDown,
  Loader2,
  Plus,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { EntityCombobox } from "@/components/shared/entity-combobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  manpowerRegistrationSchema,
  WORKER_TYPE_LABELS,
  WORKER_TYPES,
  type ManpowerRegistrationInput,
  type ManpowerRegistrationValues,
} from "@/lib/validation/manpower";
import {
  registerManpower,
  type RegisteredManpower,
} from "@/server/actions/manpower";

import { SupplierFormDialog } from "../../suppliers/supplier-form-dialog";

// Suggestions only — nationality stays free text so an unlisted one is
// never blocked.
const COMMON_NATIONALITIES = [
  "India",
  "Pakistan",
  "Bangladesh",
  "Nepal",
  "Philippines",
  "Sri Lanka",
  "Egypt",
  "Sudan",
  "Yemen",
  "Saudi Arabia",
  "Indonesia",
  "Kenya",
  "Uganda",
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY: ManpowerRegistrationValues = {
  fullName: "",
  nationality: "",
  mobile: "",
  mobilizationDate: today(),
  workerType: undefined as unknown as ManpowerRegistrationValues["workerType"],
  supplierId: "",
  iqamaNumber: "",
  designation: "",
  skillCategory: "",
  clientId: "",
  projectId: "",
  siteId: "",
  workerRate: undefined,
  clientBillingRate: undefined,
  notes: "",
};

export function ManpowerRegistrationForm({
  canCreateSupplier,
  canAssign,
}: {
  canCreateSupplier: boolean;
  canAssign: boolean;
}) {
  const [showMore, setShowMore] = useState(false);
  const [lastRegistered, setLastRegistered] =
    useState<RegisteredManpower | null>(null);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);

  const form = useForm<
    ManpowerRegistrationValues,
    unknown,
    ManpowerRegistrationInput
  >({
    resolver: zodResolver(manpowerRegistrationSchema),
    defaultValues: EMPTY,
  });
  const { errors, isSubmitting } = form.formState;
  const [workerType, supplierId, clientId, projectId, siteId] = useWatch({
    control: form.control,
    name: ["workerType", "supplierId", "clientId", "projectId", "siteId"],
  });

  // Placement and HRD-only errors live on fields inside "Additional
  // Information" — open it automatically so a validation error there is
  // never hidden behind a collapsed section.
  const additionalFieldHasError = Boolean(
    errors.iqamaNumber ||
    errors.clientId ||
    errors.projectId ||
    errors.siteId ||
    errors.workerRate ||
    errors.clientBillingRate,
  );

  async function onSubmit(values: ManpowerRegistrationInput) {
    const result = await registerManpower(values);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(`${result.data.fullName} registered as ${result.data.code}.`);
    setLastRegistered(result.data);
  }

  // Register Another: clear the person, keep the batch context (date, type,
  // supplier, placement, rates) so a run of similar workers is fast to enter.
  function registerAnother() {
    const keep = form.getValues();
    form.reset({
      ...EMPTY,
      mobilizationDate: keep.mobilizationDate,
      workerType: keep.workerType,
      supplierId: keep.supplierId,
      clientId: keep.clientId,
      projectId: keep.projectId,
      siteId: keep.siteId,
      workerRate: keep.workerRate,
      clientBillingRate: keep.clientBillingRate,
      nationality: keep.nationality,
    });
    setLastRegistered(null);
    requestAnimationFrame(() => form.setFocus("fullName"));
  }

  if (lastRegistered) {
    return (
      <Card>
        <CardContent className="space-y-5 py-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="text-success mt-0.5 size-6 shrink-0" />
            <div>
              <p className="text-lg font-semibold">
                {lastRegistered.fullName} is registered
              </p>
              <p className="text-muted-foreground text-sm">
                {lastRegistered.code} ·{" "}
                {
                  WORKER_TYPE_LABELS[
                    lastRegistered.workerType as keyof typeof WORKER_TYPE_LABELS
                  ]
                }{" "}
                ·{" "}
                {lastRegistered.assignmentId
                  ? "Deployed to site"
                  : "Not yet assigned"}{" "}
                · {lastRegistered.status === "ACTIVE" ? "Active" : "Available"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={registerAnother}>
              <UserPlus className="size-4" />
              Register Another
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={`/workers/${lastRegistered.id}`} />}
            >
              Open Worker
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={`/workers/${lastRegistered.id}/edit`} />}
            >
              Edit
            </Button>
            {canAssign && !lastRegistered.assignmentId && (
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <Link href={`/workers/${lastRegistered.id}?assign=1`} />
                }
              >
                Assign to Site
              </Button>
            )}
            <Button
              variant="ghost"
              nativeButton={false}
              render={<Link href="/workers" />}
            >
              Back to Workers
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6"
        noValidate
      >
        <Card>
          <CardContent className="py-5">
            <FieldGroup>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="fullName">Full Name *</FieldLabel>
                  <Input
                    id="fullName"
                    autoFocus
                    autoComplete="off"
                    {...form.register("fullName")}
                  />
                  {errors.fullName && (
                    <FieldError>{errors.fullName.message}</FieldError>
                  )}
                </Field>
                <Field>
                  <FieldLabel htmlFor="nationality">Nationality *</FieldLabel>
                  <Input
                    id="nationality"
                    list="nationality-options"
                    autoComplete="off"
                    {...form.register("nationality")}
                  />
                  <datalist id="nationality-options">
                    {COMMON_NATIONALITIES.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                  {errors.nationality && (
                    <FieldError>{errors.nationality.message}</FieldError>
                  )}
                </Field>
                <Field>
                  <FieldLabel htmlFor="mobile">Mobile Number *</FieldLabel>
                  <Input
                    id="mobile"
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    {...form.register("mobile")}
                  />
                  {errors.mobile && (
                    <FieldError>{errors.mobile.message}</FieldError>
                  )}
                </Field>
                <Field>
                  <FieldLabel htmlFor="mobilizationDate">
                    Mobilization Date *
                  </FieldLabel>
                  <Input
                    id="mobilizationDate"
                    type="date"
                    {...form.register("mobilizationDate")}
                  />
                  {errors.mobilizationDate && (
                    <FieldError>{errors.mobilizationDate.message}</FieldError>
                  )}
                </Field>
              </div>

              <Field>
                <FieldLabel>Worker Type *</FieldLabel>
                <div
                  role="radiogroup"
                  aria-label="Worker type"
                  className="grid grid-cols-1 gap-2 sm:grid-cols-3"
                >
                  {WORKER_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      role="radio"
                      aria-checked={workerType === type}
                      onClick={() => {
                        form.setValue("workerType", type, {
                          shouldValidate: form.formState.isSubmitted,
                        });
                        if (type !== "HRD") form.setValue("supplierId", "");
                      }}
                      className={cn(
                        "rounded-md border px-3 py-2.5 text-left text-sm transition-colors",
                        workerType === type
                          ? "border-primary bg-accent text-primary font-medium"
                          : "hover:bg-secondary border-input",
                      )}
                    >
                      {WORKER_TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
                {errors.workerType && (
                  <FieldError>{errors.workerType.message}</FieldError>
                )}
              </Field>

              {workerType === "HRD" && (
                <Field>
                  <FieldLabel htmlFor="supplierId">Supplier *</FieldLabel>
                  <div className="flex gap-2">
                    <EntityCombobox
                      id="supplierId"
                      entityType="supplier"
                      value={supplierId}
                      onChange={(id) =>
                        form.setValue("supplierId", id, {
                          shouldValidate: form.formState.isSubmitted,
                        })
                      }
                      error={errors.supplierId?.message}
                      required
                    />
                    {canCreateSupplier && (
                      <Button
                        type="button"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => setSupplierDialogOpen(true)}
                      >
                        <Plus className="size-4" />
                        New
                      </Button>
                    )}
                  </div>
                  {errors.supplierId && (
                    <FieldError>{errors.supplierId.message}</FieldError>
                  )}
                </Field>
              )}
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-0">
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              aria-expanded={showMore || additionalFieldHasError}
              className="flex w-full items-center justify-between py-4 text-left"
            >
              <span>
                <span className="block text-sm font-semibold">
                  Additional Information
                </span>
                <span className="text-muted-foreground block text-xs">
                  Iqama, trade, site placement, rates and remarks — all
                  optional, can be completed later.
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 transition-transform",
                  (showMore || additionalFieldHasError) && "rotate-180",
                )}
              />
            </button>

            {(showMore || additionalFieldHasError) && (
              <FieldGroup className="border-t pt-4 pb-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field>
                    <FieldLabel htmlFor="iqamaNumber">Iqama Number</FieldLabel>
                    <Input
                      id="iqamaNumber"
                      inputMode="numeric"
                      maxLength={10}
                      autoComplete="off"
                      {...form.register("iqamaNumber")}
                    />
                    {errors.iqamaNumber && (
                      <FieldError>{errors.iqamaNumber.message}</FieldError>
                    )}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="designation">
                      Designation / Trade
                    </FieldLabel>
                    <Input
                      id="designation"
                      placeholder="e.g. Mason, Electrician"
                      {...form.register("designation")}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="skillCategory">
                      Craft / Trade Category
                    </FieldLabel>
                    <Input
                      id="skillCategory"
                      placeholder="e.g. Skilled, Semi-skilled"
                      {...form.register("skillCategory")}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field>
                    <FieldLabel htmlFor="clientId">Client</FieldLabel>
                    <EntityCombobox
                      id="clientId"
                      entityType="client"
                      value={clientId}
                      onChange={(id) => {
                        form.setValue("clientId", id);
                        form.setValue("projectId", "");
                        form.setValue("siteId", "");
                      }}
                      error={errors.clientId?.message}
                    />
                    {errors.clientId && (
                      <FieldError>{errors.clientId.message}</FieldError>
                    )}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="projectId">Project</FieldLabel>
                    <EntityCombobox
                      id="projectId"
                      entityType="project"
                      value={projectId}
                      parentValue={clientId}
                      disabled={!clientId}
                      placeholder={
                        clientId ? undefined : "Select a client first"
                      }
                      onChange={(id) => {
                        form.setValue("projectId", id);
                        form.setValue("siteId", "");
                      }}
                      error={errors.projectId?.message}
                    />
                    {errors.projectId && (
                      <FieldError>{errors.projectId.message}</FieldError>
                    )}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="siteId">Site</FieldLabel>
                    <EntityCombobox
                      id="siteId"
                      entityType="site"
                      value={siteId}
                      parentValue={projectId}
                      disabled={!projectId}
                      placeholder={
                        projectId ? undefined : "Select a project first"
                      }
                      onChange={(id) => form.setValue("siteId", id)}
                      error={errors.siteId?.message}
                    />
                    {errors.siteId && (
                      <FieldError>{errors.siteId.message}</FieldError>
                    )}
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="workerRate">
                      Worker Rate (SAR / hour)
                    </FieldLabel>
                    <Input
                      id="workerRate"
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      {...form.register("workerRate", {
                        setValueAs: (v) =>
                          v === "" || v == null ? undefined : v,
                      })}
                    />
                    <FieldDescription>
                      What the worker is paid — kept separate from the client
                      rate.
                    </FieldDescription>
                    {errors.workerRate && (
                      <FieldError>{errors.workerRate.message}</FieldError>
                    )}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="clientBillingRate">
                      Client Billing Rate (SAR / hour)
                    </FieldLabel>
                    <Input
                      id="clientBillingRate"
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      {...form.register("clientBillingRate", {
                        setValueAs: (v) =>
                          v === "" || v == null ? undefined : v,
                      })}
                    />
                    <FieldDescription>
                      What the client is billed. Needed only when placing at a
                      site.
                    </FieldDescription>
                    {errors.clientBillingRate && (
                      <FieldError>
                        {errors.clientBillingRate.message}
                      </FieldError>
                    )}
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="notes">Notes / Remarks</FieldLabel>
                  <Textarea id="notes" rows={2} {...form.register("notes")} />
                </Field>
              </FieldGroup>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserPlus className="size-4" />
            )}
            Register Manpower
          </Button>
          <Button
            variant="ghost"
            nativeButton={false}
            render={<Link href="/workers" />}
          >
            Cancel
          </Button>
        </div>
      </form>

      {canCreateSupplier && (
        <SupplierFormDialog
          open={supplierDialogOpen}
          onOpenChange={setSupplierDialogOpen}
          onCreated={(supplier) =>
            form.setValue("supplierId", supplier.id, {
              shouldValidate: form.formState.isSubmitted,
            })
          }
        />
      )}
    </>
  );
}
