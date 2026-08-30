"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { decideLeaveRequest } from "@/server/actions/leave";

export function LeaveDecisionButtons({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function decide(decision: "APPROVED" | "REJECTED") {
    startTransition(async () => {
      const result = await decideLeaveRequest(requestId, decision);
      if (result.success) {
        toast.success(decision === "APPROVED" ? "Leave approved." : "Leave rejected.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" disabled={isPending} onClick={() => decide("APPROVED")}>
        Approve
      </Button>
      <Button size="sm" variant="outline" disabled={isPending} onClick={() => decide("REJECTED")}>
        Reject
      </Button>
    </div>
  );
}
