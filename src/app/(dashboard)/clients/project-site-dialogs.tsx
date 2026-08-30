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
import { projectFormSchema, siteFormSchema, type ProjectFormInput, type SiteFormInput } from "@/lib/validation/client";
import { createProject, createSite } from "@/server/actions/clients";

export function AddProjectDialog({ clientId, trigger }: { clientId: string; trigger: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const form = useForm<ProjectFormInput>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: { clientId, name: "", status: "ACTIVE" },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: ProjectFormInput) {
    const result = await createProject(values);
    if (result.success) {
      toast.success("Project created.");
      setOpen(false);
      form.reset({ clientId, name: "", status: "ACTIVE" });
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="projectName">Project Name *</FieldLabel>
              <Input id="projectName" {...form.register("name")} />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddSiteDialog({ projectId, trigger }: { projectId: string; trigger: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const form = useForm<SiteFormInput>({
    resolver: zodResolver(siteFormSchema),
    defaultValues: { projectId, name: "", location: "", status: "ACTIVE" },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: SiteFormInput) {
    const result = await createSite(values);
    if (result.success) {
      toast.success("Site created.");
      setOpen(false);
      form.reset({ projectId, name: "", location: "", status: "ACTIVE" });
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Site</DialogTitle>
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
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
