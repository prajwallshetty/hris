"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
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
import { ENTITY_STATUSES, projectFormSchema, siteFormSchema, type ProjectFormInput, type SiteFormInput } from "@/lib/validation/client";
import { createProject, createSite, updateProject, updateSite } from "@/server/actions/clients";

export function AddProjectDialog({
  clientId,
  trigger,
  projectId,
  defaultValues,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  clientId: string;
  trigger?: React.ReactElement;
  projectId?: string;
  defaultValues?: ProjectFormInput;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChangeProp ?? setInternalOpen;
  const router = useRouter();
  const form = useForm<ProjectFormInput>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: defaultValues ?? { clientId, name: "", status: "ACTIVE" },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: ProjectFormInput) {
    const result = projectId ? await updateProject(projectId, values) : await createProject(values);
    if (result.success) {
      toast.success(projectId ? "Project updated." : "Project created.");
      setOpen(false);
      if (!projectId) form.reset({ clientId, name: "", status: "ACTIVE" });
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{projectId ? "Edit Project" : "Add Project"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="projectName">Project Name *</FieldLabel>
              <Input id="projectName" {...form.register("name")} />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel>Status</FieldLabel>
              <Select value={form.watch("status")} onValueChange={(v) => v && form.setValue("status", v as ProjectFormInput["status"])}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0) + s.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {projectId ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddSiteDialog({
  projectId,
  trigger,
  siteId,
  defaultValues,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  projectId: string;
  trigger?: React.ReactElement;
  siteId?: string;
  defaultValues?: SiteFormInput;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChangeProp ?? setInternalOpen;
  const router = useRouter();
  const form = useForm<SiteFormInput>({
    resolver: zodResolver(siteFormSchema),
    defaultValues: defaultValues ?? { projectId, name: "", location: "", status: "ACTIVE" },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: SiteFormInput) {
    const result = siteId ? await updateSite(siteId, values) : await createSite(values);
    if (result.success) {
      toast.success(siteId ? "Site updated." : "Site created.");
      setOpen(false);
      if (!siteId) form.reset({ projectId, name: "", location: "", status: "ACTIVE" });
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{siteId ? "Edit Site" : "Add Site"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="siteName">Site Name *</FieldLabel>
              <Input id="siteName" {...form.register("name")} />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="siteLocation">Location</FieldLabel>
              <Input id="siteLocation" {...form.register("location")} />
            </Field>
            <Field>
              <FieldLabel>Status</FieldLabel>
              <Select value={form.watch("status")} onValueChange={(v) => v && form.setValue("status", v as SiteFormInput["status"])}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0) + s.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {siteId ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
