"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/shared/error-state";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <ErrorState onRetry={reset} />
    </div>
  );
}
