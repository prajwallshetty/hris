"use client";

import { Check, Loader2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { Textarea } from "@/components/ui/textarea";
import { decideTimesheetItem } from "@/server/actions/timesheets";

export function TimesheetItemActions({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  function approve() {
    startTransition(async () => {
      const result = await decideTimesheetItem({ itemId, decision: "APPROVED" });
      if (result.success) {
        toast.success("Entry approved.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function reject() {
    if (!reason.trim()) {
      toast.error("A reason is required to reject this entry.");
      return;
    }
    startTransition(async () => {
      const result = await decideTimesheetItem({ itemId, decision: "REJECTED", reason });
      if (result.success) {
        toast.success("Entry rejected.");
        setRejectOpen(false);
        setReason("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Button size="sm" variant="outline" onClick={approve} disabled={isPending}>
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        Approve
      </Button>
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogTrigger
          render={
            <Button size="sm" variant="outline" disabled={isPending}>
              <X className="size-4" />
              Reject
            </Button>
          }
        />
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject this entry</DialogTitle>
            <DialogDescription>A reason is required so the worker/coordinator can correct it.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. logout time doesn't match the site guard log"
            rows={3}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={reject} disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Reject Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
