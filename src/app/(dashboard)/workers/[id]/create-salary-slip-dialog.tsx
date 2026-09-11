"use client";

import { FileText, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createSalarySlipForWorker } from "@/server/actions/payroll";

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** "Create Salary Slip" from a worker's own page — the HR user just picks
 * a month, no payroll-period concept required. Behind the scenes this
 * finds/creates the matching period and generates payroll for only this
 * worker (createSalarySlipForWorker), reusing the same calculation engine
 * the Payroll module already uses. */
export function CreateSalarySlipDialog({ workerId, workerName }: { workerId: string; workerName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(currentMonth());
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      const result = await createSalarySlipForWorker(workerId, month);
      if (result.success) {
        toast.success("Salary slip ready.");
        setOpen(false);
        router.push(`/payroll/worker/${result.data.workerPayrollId}`);
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <FileText className="size-4" />
            Create Salary Slip
          </Button>
        }
      />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Salary Slip</DialogTitle>
          <DialogDescription>
            For {workerName}. Approved and locked hours for the selected month load automatically.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="salary-slip-month">Salary Period</FieldLabel>
          <Input id="salary-slip-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </Field>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
