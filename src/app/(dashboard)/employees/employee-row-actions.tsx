"use client";

import { Archive, ArchiveRestore, Eye, MoreHorizontal, Pencil } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

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
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { archiveEmployee, reactivateEmployee } from "@/server/actions/employees";

/** Row "…" menu for the Employees list — View / Edit / Archive / Reactivate,
 * matching the Workers/Coordinators/Users list pattern. */
export function EmployeeRowActions({
  employeeId,
  employeeName,
  deletedAt,
  canEdit,
  canArchive,
}: {
  employeeId: string;
  employeeName: string;
  deletedAt: Date | null;
  canEdit: boolean;
  canArchive: boolean;
}) {
  const router = useRouter();
  const [confirmMode, setConfirmMode] = useState<"archive" | "reactivate" | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleConfirm() {
    if (!confirmMode) return;
    setIsPending(true);
    try {
      const result = confirmMode === "archive" ? await archiveEmployee(employeeId) : await reactivateEmployee(employeeId);
      if (result.success) {
        toast.success(confirmMode === "archive" ? `${employeeName} archived.` : `${employeeName} reactivated.`);
        setConfirmMode(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${employeeName}`}>
              <MoreHorizontal className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            render={
              <Link href={`/employees/${employeeId}`}>
                <Eye className="size-4" />
                View
              </Link>
            }
          />
          {canEdit && !deletedAt && (
            <DropdownMenuItem
              render={
                <Link href={`/employees/${employeeId}/edit`}>
                  <Pencil className="size-4" />
                  Edit
                </Link>
              }
            />
          )}
          {canArchive && !deletedAt && (
            <DropdownMenuItem variant="destructive" onClick={() => setConfirmMode("archive")}>
              <Archive className="size-4" />
              Archive
            </DropdownMenuItem>
          )}
          {canArchive && deletedAt && (
            <DropdownMenuItem onClick={() => setConfirmMode("reactivate")}>
              <ArchiveRestore className="size-4" />
              Reactivate
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmMode != null} onOpenChange={(open) => !open && setConfirmMode(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmMode === "archive" ? `Archive ${employeeName}?` : `Reactivate ${employeeName}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmMode === "archive"
                ? "They'll be hidden from active lists, but their payroll, attendance, and leave history stay intact and recoverable."
                : "They'll become available again in active lists and pickers."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isPending}
              className={confirmMode === "archive" ? "bg-destructive hover:bg-destructive/90" : undefined}
            >
              {isPending ? "Please wait…" : confirmMode === "archive" ? "Archive" : "Reactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
