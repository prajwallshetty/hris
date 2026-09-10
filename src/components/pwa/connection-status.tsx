"use client";

import { WifiOff } from "lucide-react";

import { usePwa } from "@/components/pwa/pwa-provider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ConnectionStatus() {
  const { isOnline } = usePwa();

  if (isOnline) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200 animate-pulse cursor-help"
          >
            <WifiOff className="size-3 shrink-0" />
            <span>Offline</span>
          </div>
        }
      />
      <TooltipContent side="bottom" className="max-w-xs text-xs">
        You are offline. Sensitive operations like payroll, payments, and approvals are paused until connection is restored.
      </TooltipContent>
    </Tooltip>
  );
}
