"use client";

import { Download } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";

export function ExportWorkersButton() {
  const searchParams = useSearchParams();
  const params = new URLSearchParams();
  const q = searchParams.get("q");
  const status = searchParams.get("status");
  if (q) params.set("q", q);
  if (status) params.set("status", status);

  return (
    <Button
      variant="outline"
      render={
        <a href={`/api/workers/export?${params.toString()}`}>
          <Download className="size-4" />
          Export CSV
        </a>
      }
    />
  );
}
