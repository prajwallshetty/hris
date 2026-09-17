"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ErrorRow = { rowNumber: number; iqamaNumber: string | null; errors: string[] };

/** §7 — "view import details and error rows", without ever surfacing the
 * raw errorReport JSON directly to the user. */
export function ImportErrorsDialog({ fileName, errorReport }: { fileName: string; errorReport: ErrorRow[] }) {
  const [open, setOpen] = useState(false);
  if (errorReport.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm">
            <AlertTriangle className="size-4" />
            View Errors ({errorReport.length})
          </Button>
        }
      />
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Rows not imported — {fileName}</DialogTitle>
          <DialogDescription>These rows were skipped. Fix the file and re-upload if needed.</DialogDescription>
        </DialogHeader>
        <div className="max-h-96 overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Row</TableHead>
                <TableHead>Iqama</TableHead>
                <TableHead>Issue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {errorReport.map((e) => (
                <TableRow key={e.rowNumber}>
                  <TableCell>{e.rowNumber}</TableCell>
                  <TableCell>{e.iqamaNumber ?? "—"}</TableCell>
                  <TableCell className="text-destructive">{e.errors.join(" ")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
