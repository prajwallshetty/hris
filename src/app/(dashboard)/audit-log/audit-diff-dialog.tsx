"use client";

import { Eye } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { diffAuditValues, getAuditEntryLabel } from "@/lib/audit-log-format";

/** §37 — click a row to see what changed, as readable field rows (never
 * raw JSON, never the bare record id). */
export function AuditDiffDialog({
  entityType,
  previousValue,
  newValue,
}: {
  entityType: string;
  previousValue: unknown;
  newValue: unknown;
}) {
  const [open, setOpen] = useState(false);
  const fields = diffAuditValues(previousValue, newValue);
  const label = getAuditEntryLabel(previousValue, newValue);

  if (fields.length === 0) return null;

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
          <DialogTitle>{label ? `${entityType} — ${label}` : entityType}</DialogTitle>
          <DialogDescription>Recorded values before and after this change.</DialogDescription>
        </DialogHeader>
        <div className="max-h-96 overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Field</TableHead>
                <TableHead>Before</TableHead>
                <TableHead>After</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field) => (
                <TableRow key={field.key}>
                  <TableCell className="text-muted-foreground font-medium">{field.label}</TableCell>
                  <TableCell className={field.changed ? "text-muted-foreground line-through" : undefined}>
                    {field.before}
                  </TableCell>
                  <TableCell className={field.changed ? "font-medium" : undefined}>{field.after}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
