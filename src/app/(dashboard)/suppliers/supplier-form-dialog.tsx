"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useClearNewParam } from "@/lib/use-clear-new-param";
import { supplierFormSchema, type SupplierFormInput } from "@/lib/validation/manpower";
import { createSupplier, updateSupplier } from "@/server/actions/suppliers";

const EMPTY: SupplierFormInput = { name: "", contactPerson: "", phone: "", email: "", notes: "" };

export function SupplierFormDialog({
  trigger,
  supplierId,
  defaultValues,
  defaultOpen,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  onCreated,
}: {
  trigger?: React.ReactElement;
  supplierId?: string;
  defaultValues?: SupplierFormInput;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Lets the registration form select a supplier it just created inline. */
  onCreated?: (supplier: { id: string; name: string }) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen ?? false);
  useClearNewParam(Boolean(defaultOpen));
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChangeProp ?? setInternalOpen;
  const router = useRouter();
  const form = useForm<SupplierFormInput>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: defaultValues ?? EMPTY,
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: SupplierFormInput) {
    if (supplierId) {
      const result = await updateSupplier(supplierId, values);
      if (!result.success) return toast.error(result.error);
      toast.success("Supplier updated.");
    } else {
      const result = await createSupplier(values);
      if (!result.success) return toast.error(result.error);
      toast.success(`Supplier "${result.data.name}" added.`);
      onCreated?.(result.data);
      form.reset(EMPTY);
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{supplierId ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
        </DialogHeader>
        {/* Stop the submit bubbling to a parent form — this dialog is also
            opened from inside the manpower registration form. */}
        <form
          onSubmit={(e) => {
            e.stopPropagation();
            void form.handleSubmit(onSubmit)(e);
          }}
          className="space-y-4"
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="supplier-name">Supplier name *</FieldLabel>
              <Input id="supplier-name" {...form.register("name")} />
              {errors.name && <FieldError>{errors.name.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="supplier-contact">Contact person</FieldLabel>
              <Input id="supplier-contact" {...form.register("contactPerson")} />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="supplier-phone">Phone</FieldLabel>
                <Input id="supplier-phone" {...form.register("phone")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="supplier-email">Email</FieldLabel>
                <Input id="supplier-email" type="email" {...form.register("email")} />
                {errors.email && <FieldError>{errors.email.message}</FieldError>}
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="supplier-notes">Notes</FieldLabel>
              <Textarea id="supplier-notes" rows={2} {...form.register("notes")} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {supplierId ? "Save Changes" : "Add Supplier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
