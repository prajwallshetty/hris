"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronLeft, ChevronRight, Loader2, Trash2, Upload, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DOCUMENT_TYPES } from "@/lib/validation/document";
import { WORKER_STATUSES, workerFormSchema, type WorkerFormInput, type WorkerFormValues } from "@/lib/validation/worker";
import { uploadWorkerDocument } from "@/server/actions/documents";
import { createAssignment } from "@/server/actions/assignments";
import { checkIqamaAvailability, createWorker } from "@/server/actions/workers";

type Coordinator = { id: string; name: string };
type ClientTree = {
  id: string;
  companyName: string;
  projects: { id: string; name: string; sites: { id: string; name: string }[] }[];
};

type StagedDocument = { file: File; documentType: string; expiryDate: string };

type AssignmentDraft = {
  clientId: string;
  projectId: string;
  siteId: string;
  designation: string;
  workerHourlyRate: string;
  clientBillingRate: string;
  startDate: string;
  coordinatorId: string;
};

const CORE_STEPS: { key: string; title: string; fields: (keyof WorkerFormInput)[] }[] = [
  { key: "basic", title: "Basic Information", fields: ["fullName", "nationality", "dateOfBirth", "status"] },
  { key: "identity", title: "Identity & Iqama", fields: ["iqamaNumber", "iqamaExpiryDate", "passportNumber", "passportExpiryDate"] },
  { key: "contact", title: "Contact", fields: ["mobile", "bankName", "bankAccountIban"] },
  {
    key: "designation",
    title: "Designation",
    fields: ["designation", "skillCategory", "coordinatorId", "joiningDate", "mobilizationDate", "demobilizationDate"],
  },
  { key: "salary", title: "Salary & Rate", fields: ["hourlyRate", "overtimeRate"] },
];

const STEPS = [...CORE_STEPS, { key: "documents", title: "Documents" }, { key: "assignment", title: "Assignment" }, { key: "review", title: "Review" }];

function emptyAssignment(): AssignmentDraft {
  return {
    clientId: "",
    projectId: "",
    siteId: "",
    designation: "",
    workerHourlyRate: "",
    clientBillingRate: "",
    startDate: new Date().toISOString().slice(0, 10),
    coordinatorId: "",
  };
}

/** Guided worker-creation wizard (§ redesign): Basic Info → Identity/Iqama →
 * Contact → Designation → Salary/Rate → Documents → Assignment → Review →
 * Create. Documents and the initial assignment are staged client-side and
 * only committed (uploaded / created) once the worker record itself exists
 * — neither can reference a workerId before that point. */
export function WorkerCreateWizard({ coordinators, clients }: { coordinators: Coordinator[]; clients: ClientTree[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [iqamaStatus, setIqamaStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [documents, setDocuments] = useState<StagedDocument[]>([]);
  const [assignment, setAssignment] = useState<AssignmentDraft>(emptyAssignment());
  const [includeAssignment, setIncludeAssignment] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<WorkerFormValues, unknown, WorkerFormInput>({
    resolver: zodResolver(workerFormSchema),
    defaultValues: {
      iqamaNumber: "",
      fullName: "",
      mobile: "",
      passportNumber: "",
      passportExpiryDate: "",
      iqamaExpiryDate: "",
      nationality: "",
      dateOfBirth: "",
      designation: "",
      skillCategory: "",
      joiningDate: "",
      mobilizationDate: "",
      demobilizationDate: "",
      coordinatorId: "",
      hourlyRate: undefined,
      overtimeRate: undefined,
      status: "AVAILABLE",
      bankName: "",
      bankAccountIban: "",
      notes: "",
    },
  });

  const { errors } = form.formState;
  const values = form.watch();

  const projects = useMemo(
    () => clients.find((c) => c.id === assignment.clientId)?.projects ?? [],
    [clients, assignment.clientId],
  );
  const sites = useMemo(
    () => projects.find((p) => p.id === assignment.projectId)?.sites ?? [],
    [projects, assignment.projectId],
  );

  async function handleIqamaBlur() {
    const iqama = form.getValues("iqamaNumber");
    if (!/^\d{10}$/.test(iqama.trim())) {
      setIqamaStatus("idle");
      return;
    }
    setIqamaStatus("checking");
    const result = await checkIqamaAvailability(iqama);
    if (result.success) {
      setIqamaStatus(result.data.available ? "available" : "taken");
    } else {
      setIqamaStatus("idle");
    }
  }

  async function goNext() {
    const current = CORE_STEPS[step];
    if (current) {
      const valid = await form.trigger(current.fields);
      if (!valid) return;
      if (current.key === "identity") {
        if (iqamaStatus === "idle") await handleIqamaBlur();
        if (iqamaStatus === "taken") {
          toast.error("This Iqama number is already registered to another worker.");
          return;
        }
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function addDocumentFiles(fileList: FileList | null) {
    if (!fileList) return;
    const next = Array.from(fileList).map((file) => ({ file, documentType: "", expiryDate: "" }));
    setDocuments((prev) => [...prev, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleCreate() {
    const valid = await form.trigger();
    if (!valid) {
      toast.error("Please review the earlier steps — some required fields are missing.");
      return;
    }
    const parsed = workerFormSchema.parse(form.getValues());
    setIsCreating(true);
    try {
      const result = await createWorker(parsed);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      const workerId = result.data.id;

      for (const doc of documents) {
        const formData = new FormData();
        formData.append("workerId", workerId);
        formData.append("file", doc.file);
        formData.append("documentType", doc.documentType);
        formData.append("expiryDate", doc.expiryDate);
        const uploadResult = await uploadWorkerDocument(formData);
        if (!uploadResult.success) {
          toast.error(`"${doc.file.name}" failed to upload: ${uploadResult.error}`);
        }
      }

      if (includeAssignment && assignment.clientId && assignment.projectId && assignment.siteId) {
        const assignResult = await createAssignment({
          workerId,
          clientId: assignment.clientId,
          projectId: assignment.projectId,
          siteId: assignment.siteId,
          designation: assignment.designation,
          workerHourlyRate: Number(assignment.workerHourlyRate) || 0,
          clientBillingRate: Number(assignment.clientBillingRate) || 0,
          startDate: assignment.startDate,
          coordinatorId: assignment.coordinatorId,
          notes: "",
        });
        if (!assignResult.success) {
          toast.error(`Worker created, but the assignment could not be created: ${assignResult.error}`);
        }
      }

      toast.success("Worker created.");
      router.push(`/workers/${workerId}`);
      router.refresh();
    } finally {
      setIsCreating(false);
    }
  }

  const progressPct = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            Step {step + 1} of {STEPS.length}: {STEPS[step].title}
          </span>
          <span className="text-muted-foreground">{Math.round(progressPct)}%</span>
        </div>
        <Progress value={progressPct} />
        <div className="flex flex-wrap gap-1.5 pt-1">
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                i === step
                  ? "bg-primary text-primary-foreground"
                  : i < step
                    ? "bg-primary/10 text-primary cursor-pointer"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
            >
              {i < step && <Check className="mr-1 inline size-3" />}
              {s.title}
            </button>
          ))}
        </div>
      </div>

      {STEPS[step].key === "basic" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Basic Information</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="fullName">Full Name *</FieldLabel>
                <Input id="fullName" {...form.register("fullName")} />
                {errors.fullName && <FieldError>{errors.fullName.message}</FieldError>}
              </Field>
              <Field>
                <FieldLabel htmlFor="nationality">Nationality</FieldLabel>
                <Input id="nationality" {...form.register("nationality")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="dateOfBirth">Date of Birth</FieldLabel>
                <Input id="dateOfBirth" type="date" {...form.register("dateOfBirth")} />
              </Field>
              <Field>
                <FieldLabel>Status</FieldLabel>
                <Select value={form.watch("status")} onValueChange={(v) => v && form.setValue("status", v as WorkerFormInput["status"])}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WORKER_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.replaceAll("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      )}

      {STEPS[step].key === "identity" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identity & Iqama</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="iqamaNumber">Iqama Number *</FieldLabel>
                <Input
                  id="iqamaNumber"
                  {...form.register("iqamaNumber")}
                  placeholder="10 digits"
                  onBlur={handleIqamaBlur}
                  onChange={(e) => {
                    form.setValue("iqamaNumber", e.target.value);
                    setIqamaStatus("idle");
                  }}
                />
                {errors.iqamaNumber && <FieldError>{errors.iqamaNumber.message}</FieldError>}
                {iqamaStatus === "checking" && <p className="text-muted-foreground text-xs">Checking availability…</p>}
                {iqamaStatus === "available" && (
                  <p className="text-success flex items-center gap-1 text-xs">
                    <Check className="size-3" /> Available
                  </p>
                )}
                {iqamaStatus === "taken" && (
                  <p className="text-destructive flex items-center gap-1 text-xs">
                    <X className="size-3" /> Already registered to another worker
                  </p>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="iqamaExpiryDate">Iqama Expiry Date</FieldLabel>
                <Input id="iqamaExpiryDate" type="date" {...form.register("iqamaExpiryDate")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="passportNumber">Passport Number</FieldLabel>
                <Input id="passportNumber" {...form.register("passportNumber")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="passportExpiryDate">Passport Expiry Date</FieldLabel>
                <Input id="passportExpiryDate" type="date" {...form.register("passportExpiryDate")} />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      )}

      {STEPS[step].key === "contact" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="mobile">Mobile</FieldLabel>
                <Input id="mobile" {...form.register("mobile")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="bankName">Bank Name</FieldLabel>
                <Input id="bankName" {...form.register("bankName")} />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="bankAccountIban">IBAN / Account Number</FieldLabel>
                <Input id="bankAccountIban" {...form.register("bankAccountIban")} />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      )}

      {STEPS[step].key === "designation" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Designation</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="designation">Designation</FieldLabel>
                <Input id="designation" {...form.register("designation")} placeholder="e.g. Scaffolder" />
              </Field>
              <Field>
                <FieldLabel htmlFor="skillCategory">Skill / Category</FieldLabel>
                <Input id="skillCategory" {...form.register("skillCategory")} />
              </Field>
              <Field>
                <FieldLabel>Coordinator</FieldLabel>
                <Select
                  value={form.watch("coordinatorId") || "NONE"}
                  onValueChange={(value) => form.setValue("coordinatorId", value === "NONE" ? "" : (value ?? ""))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None</SelectItem>
                    {coordinators.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="joiningDate">Joining Date</FieldLabel>
                <Input id="joiningDate" type="date" {...form.register("joiningDate")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="mobilizationDate">Mobilization Date</FieldLabel>
                <Input id="mobilizationDate" type="date" {...form.register("mobilizationDate")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="demobilizationDate">Demobilization Date</FieldLabel>
                <Input id="demobilizationDate" type="date" {...form.register("demobilizationDate")} />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      )}

      {STEPS[step].key === "salary" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Salary & Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="hourlyRate">Hourly Rate (SAR)</FieldLabel>
                <Input id="hourlyRate" type="number" step="0.01" {...form.register("hourlyRate")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="overtimeRate">Overtime Rate (SAR)</FieldLabel>
                <Input id="overtimeRate" type="number" step="0.01" {...form.register("overtimeRate")} />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="notes">Notes</FieldLabel>
                <Textarea id="notes" rows={3} {...form.register("notes")} />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      )}

      {STEPS[step].key === "documents" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Optional — attach Iqama, passport, or contract copies now. They&apos;ll be uploaded once the worker is created.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => addDocumentFiles(e.target.files)}
            />
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="size-4" />
              Choose Files
            </Button>

            {documents.length > 0 && (
              <div className="space-y-2">
                {documents.map((doc, idx) => (
                  <div key={idx} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
                    <Badge variant="outline" className="max-w-40 truncate">
                      {doc.file.name}
                    </Badge>
                    <Select
                      value={doc.documentType || "NONE"}
                      onValueChange={(v) =>
                        setDocuments((prev) => prev.map((d, i) => (i === idx ? { ...d, documentType: v === "NONE" ? "" : (v ?? "") } : d)))
                      }
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">Unspecified</SelectItem>
                        {DOCUMENT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="date"
                      className="w-40"
                      value={doc.expiryDate}
                      onChange={(e) =>
                        setDocuments((prev) => prev.map((d, i) => (i === idx ? { ...d, expiryDate: e.target.value } : d)))
                      }
                      aria-label="Expiry date"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="ml-auto"
                      onClick={() => setDocuments((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {STEPS[step].key === "assignment" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeAssignment}
                onChange={(e) => setIncludeAssignment(e.target.checked)}
                className="size-4"
              />
              Assign this worker to a client/site now
            </label>

            {includeAssignment && (
              <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field>
                  <FieldLabel>Client</FieldLabel>
                  <Select
                    value={assignment.clientId}
                    onValueChange={(v) => setAssignment((a) => ({ ...emptyAssignment(), startDate: a.startDate, clientId: v ?? "" }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Project</FieldLabel>
                  <Select
                    value={assignment.projectId}
                    disabled={!assignment.clientId}
                    onValueChange={(v) => setAssignment((a) => ({ ...a, projectId: v ?? "", siteId: "" }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Site</FieldLabel>
                  <Select
                    value={assignment.siteId}
                    disabled={!assignment.projectId}
                    onValueChange={(v) => setAssignment((a) => ({ ...a, siteId: v ?? "" }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select site" />
                    </SelectTrigger>
                    <SelectContent>
                      {sites.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Worker Hourly Rate (SAR)</FieldLabel>
                  <Input
                    type="number"
                    step="0.01"
                    value={assignment.workerHourlyRate}
                    onChange={(e) => setAssignment((a) => ({ ...a, workerHourlyRate: e.target.value }))}
                  />
                </Field>
                <Field>
                  <FieldLabel>Client Billing Rate (SAR)</FieldLabel>
                  <Input
                    type="number"
                    step="0.01"
                    value={assignment.clientBillingRate}
                    onChange={(e) => setAssignment((a) => ({ ...a, clientBillingRate: e.target.value }))}
                  />
                </Field>
                <Field>
                  <FieldLabel>Start Date</FieldLabel>
                  <Input
                    type="date"
                    value={assignment.startDate}
                    onChange={(e) => setAssignment((a) => ({ ...a, startDate: e.target.value }))}
                  />
                </Field>
                <Field>
                  <FieldLabel>Coordinator</FieldLabel>
                  <Select
                    value={assignment.coordinatorId || "NONE"}
                    onValueChange={(v) => setAssignment((a) => ({ ...a, coordinatorId: v === "NONE" ? "" : (v ?? "") }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">None</SelectItem>
                      {coordinators.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>
            )}
          </CardContent>
        </Card>
      )}

      {STEPS[step].key === "review" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review & Create</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-sm">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase">Basic</p>
                <p className="font-medium">{values.fullName || "—"}</p>
                <p className="text-muted-foreground">{values.nationality || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase">Identity</p>
                <p className="font-medium">{values.iqamaNumber}</p>
                <p className="text-muted-foreground">Passport: {values.passportNumber || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase">Contact</p>
                <p>{values.mobile || "—"}</p>
                <p className="text-muted-foreground">{values.bankName || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase">Designation</p>
                <p>{values.designation || "—"}</p>
                <p className="text-muted-foreground">
                  {coordinators.find((c) => c.id === values.coordinatorId)?.name ?? "No coordinator"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase">Salary</p>
                <p>Hourly: {values.hourlyRate ? String(values.hourlyRate) : "—"}</p>
                <p className="text-muted-foreground">Overtime: {values.overtimeRate ? String(values.overtimeRate) : "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase">Documents</p>
                <p>{documents.length > 0 ? `${documents.length} file(s) staged` : "None"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase">Assignment</p>
                {includeAssignment && assignment.clientId ? (
                  <p>
                    {clients.find((c) => c.id === assignment.clientId)?.companyName} /{" "}
                    {projects.find((p) => p.id === assignment.projectId)?.name} /{" "}
                    {sites.find((s) => s.id === assignment.siteId)?.name}
                  </p>
                ) : (
                  <p className="text-muted-foreground">Not assigned yet</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between gap-2">
        <Button type="button" variant="outline" onClick={goBack} disabled={step === 0 || isCreating}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
        {STEPS[step].key === "review" ? (
          <Button type="button" onClick={handleCreate} disabled={isCreating}>
            {isCreating && <Loader2 className="size-4 animate-spin" />}
            Create Worker
          </Button>
        ) : (
          <Button type="button" onClick={goNext}>
            Next
            <ChevronRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
