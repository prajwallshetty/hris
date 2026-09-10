"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

/** Triggers a server action (bound with the list's current filters) that
 * returns the full filtered CSV — not just the current page — and downloads
 * it client-side. Used to keep "Export" honest with server-paginated lists
 * (§14 — filtered download must reflect exactly what's filtered). */
export function ExportCsvButton({
  action,
  filename,
  label = "Export CSV",
}: {
  action: () => Promise<ActionResult<{ csv: string }>>;
  filename: string;
  label?: string;
}) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      const result = await action();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      {label}
    </Button>
  );
}
