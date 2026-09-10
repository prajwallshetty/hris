"use client";

import { Ban, Eye, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cancelInvoice } from "@/server/actions/invoices";

/** Row "…" menu for the Invoices list — View, plus a quick Cancel for
 * invoices still in Draft/Approved (not yet billed). Issued/paid invoices
 * are never editable or cancellable from here — they're historical
 * financial records once sent to the client. */
export function InvoiceRowActions({
  invoiceId,
  invoiceNumber,
  status,
  canUpdate,
}: {
  invoiceId: string;
  invoiceNumber: number;
  status: string;
  canUpdate: boolean;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function handleCancel() {
    setIsPending(true);
    try {
      const result = await cancelInvoice(invoiceId);
      if (result.success) {
        toast.success(`Invoice #${invoiceNumber} cancelled.`);
        setConfirmOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsPending(false);
    }
  }

  const canCancel = canUpdate && (status === "DRAFT" || status === "APPROVED");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for invoice #${invoiceNumber}`}>
              <MoreHorizontal className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            render={
              <Link href={`/invoices/${invoiceId}`}>
                <Eye className="size-4" />
                View
              </Link>
            }
          />
          {canCancel && (
            <DropdownMenuItem variant="destructive" onClick={() => setConfirmOpen(true)}>
              <Ban className="size-4" />
              Cancel
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel invoice #{invoiceNumber}?</AlertDialogTitle>
            <AlertDialogDescription>This invoice will no longer be billable.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Back</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={isPending} className="bg-destructive hover:bg-destructive/90">
              {isPending ? "Please wait…" : "Cancel Invoice"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
