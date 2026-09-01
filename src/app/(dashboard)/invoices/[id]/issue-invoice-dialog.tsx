"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { issueInvoice } from "@/server/actions/invoices";

export function IssueInvoiceDialog({ invoiceId, trigger }: { invoiceId: string; trigger: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  async function submit() {
    setIsSubmitting(true);
    try {
      const result = await issueInvoice({ invoiceId, dueDate });
      if (result.success) {
        toast.success("Invoice issued.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Issue Invoice</DialogTitle>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="dueDate">Due Date *</FieldLabel>
          <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={isSubmitting || !dueDate}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Issue Invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
