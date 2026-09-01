"use client";

import { Eye } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

function formatJson(value: unknown) {
  if (value === null || value === undefined) return null;
  return JSON.stringify(value, null, 2);
}

/** §37 — click a row to see the before/after values behind an audit entry. */
export function AuditDiffDialog({
  entityType,
  entityId,
  previousValue,
  newValue,
}: {
  entityType: string;
  entityId: string;
  previousValue: unknown;
  newValue: unknown;
}) {
  const [open, setOpen] = useState(false);
  const before = formatJson(previousValue);
  const after = formatJson(newValue);

  if (!before && !after) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm">
            <Eye className="size-4" />
            View
          </Button>
        }
      />
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {entityType} — {entityId}
          </DialogTitle>
          <DialogDescription>Recorded values before and after this change.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground mb-1.5 text-xs font-medium">Before</p>
            <pre className="bg-muted max-h-80 overflow-auto rounded-md p-3 text-xs">{before ?? "—"}</pre>
          </div>
          <div>
            <p className="text-muted-foreground mb-1.5 text-xs font-medium">After</p>
            <pre className="bg-muted max-h-80 overflow-auto rounded-md p-3 text-xs">{after ?? "—"}</pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
