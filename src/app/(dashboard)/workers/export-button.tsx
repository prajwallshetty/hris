"use client";

import { Download } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";

export function ExportWorkersButton() {
  const searchParams = useSearchParams();
  const params = new URLSearchParams();
  // Export exactly what the list is currently filtered to.
  for (const key of ["q", "status", "type", "supplier", "unassigned", "expiring"]) {
    const value = searchParams.get(key);
    if (value) params.set(key, value);
  }

  return (
    <Button variant="outline" className="rounded-full" nativeButton={false} render={<a href={`/api/workers/export?${params.toString()}`} />}>
      <Download className="size-4" />
      Export CSV
    </Button>
  );
}
