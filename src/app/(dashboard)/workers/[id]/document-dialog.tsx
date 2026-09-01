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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DOCUMENT_TYPES, documentFormSchema, type DocumentFormInput, type DocumentFormValues } from "@/lib/validation/document";
import { uploadWorkerDocument } from "@/server/actions/documents";

export function DocumentDialog({ workerId }: { workerId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const defaults: DocumentFormValues = { workerId, fileName: "", fileUrl: "", documentType: "", expiryDate: "" };
  const form = useForm<DocumentFormValues, unknown, DocumentFormInput>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: DocumentFormInput) {
    const result = await uploadWorkerDocument(values);
    if (result.success) {
      toast.success("Document added.");
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
            Add Document
          </Button>
        }
      />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Document</DialogTitle>
          <DialogDescription>Link to a document already hosted elsewhere (e.g. a shared drive link).</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="fileName">File Name *</FieldLabel>
              <Input id="fileName" {...form.register("fileName")} placeholder="e.g. Iqama scan.pdf" />
              {errors.fileName && <FieldError>{errors.fileName.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="fileUrl">Document URL *</FieldLabel>
              <Input id="fileUrl" {...form.register("fileUrl")} placeholder="https://…" />
              {errors.fileUrl && <FieldError>{errors.fileUrl.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel>Document Type</FieldLabel>
              <Select
                value={form.watch("documentType") || "NONE"}
                onValueChange={(v) => form.setValue("documentType", v === "NONE" ? "" : (v ?? ""))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None</SelectItem>
                  {DOCUMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="expiryDate">Expiry Date</FieldLabel>
              <Input id="expiryDate" type="date" {...form.register("expiryDate")} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Add Document
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
