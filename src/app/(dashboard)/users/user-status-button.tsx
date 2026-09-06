"use client";

import { ShieldOff, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { archiveUser, reactivateUser } from "@/server/actions/users";

export function UserStatusButton({ userId, userName, status }: { userId: string; userName: string; status: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();
  const isActive = status === "ACTIVE";

  async function handleConfirm() {
    setIsPending(true);
    try {
      const result = isActive ? await archiveUser(userId) : await reactivateUser(userId);
      if (result.success) {
        toast.success(isActive ? "User disabled." : "User reactivated.");
        setOpen(false);
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
      <DropdownMenuItem
        variant={isActive ? "destructive" : "default"}
        onSelect={(e) => e.preventDefault()}
        onClick={() => setOpen(true)}
      >
        {isActive ? <ShieldOff className="size-4" /> : <ShieldCheck className="size-4" />}
        {isActive ? "Disable Account" : "Reactivate Account"}
      </DropdownMenuItem>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isActive ? `Disable ${userName}'s account?` : `Reactivate ${userName}'s account?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {isActive
                ? "They will no longer be able to sign in with their access code, effective immediately."
                : "They will be able to sign in with their access code again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isPending}
              className={isActive ? "bg-destructive hover:bg-destructive/90" : undefined}
            >
              {isPending ? "Please wait…" : isActive ? "Disable" : "Reactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
