"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { updateVehicleMaintenanceStatus } from "@/server/actions/vehicles";

const NEXT_STATUS: Record<string, { next: "IN_PROGRESS" | "COMPLETED"; label: string } | undefined> = {
  SCHEDULED: { next: "IN_PROGRESS", label: "Start" },
  IN_PROGRESS: { next: "COMPLETED", label: "Complete" },
};

export function MaintenanceStatusButton({ id, status }: { id: string; status: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const step = NEXT_STATUS[status];
  if (!step) return null;

  function handleClick() {
    startTransition(async () => {
      const result = await updateVehicleMaintenanceStatus(id, step!.next);
      if (result.success) {
        toast.success(`Maintenance marked ${step!.label.toLowerCase()}ed.`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={handleClick} disabled={isPending}>
      {isPending ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
      {step.label}
    </Button>
  );
}
