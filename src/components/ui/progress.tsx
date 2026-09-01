"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";

import { cn } from "@/lib/utils";

function Progress({ className, value, ...props }: ProgressPrimitive.Root.Props) {
  return (
    <ProgressPrimitive.Root data-slot="progress" value={value} className={cn("w-full", className)} {...props}>
      <ProgressPrimitive.Track data-slot="progress-track" className="bg-muted relative h-1.5 w-full overflow-hidden rounded-full">
        <ProgressPrimitive.Indicator
          data-slot="progress-indicator"
          className="bg-primary h-full rounded-full transition-[width] duration-300 ease-out data-[status=indeterminate]:animate-pulse"
        />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  );
}

export { Progress };
