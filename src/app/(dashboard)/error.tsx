"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/shared/error-state";

// Dev-only: the friendly ErrorState never reveals the real exception (by
// design — no stack traces in front of end users), but that same silence
// makes a real bug indistinguishable from "expected empty state" while
// debugging. In development only, render the actual message/digest/stack
// so the underlying exception is visible without needing to dig through
// server logs. Never gated by anything the client can influence — purely
// process.env.NODE_ENV, inlined at build time, so this block is dead code
// (and removed by the bundler) in a production build.
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-2xl space-y-4">
        <ErrorState onRetry={reset} />
        {process.env.NODE_ENV !== "production" && (
          <div className="overflow-auto rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-left font-mono text-xs text-destructive">
            <p className="font-semibold">[DEV ONLY] {error.name}: {error.message}</p>
            {error.digest && <p className="mt-1">digest: {error.digest}</p>}
            {error.stack && <pre className="mt-2 whitespace-pre-wrap">{error.stack}</pre>}
          </div>
        )}
      </div>
    </div>
  );
}
