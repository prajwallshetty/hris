"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

export function ConfirmActionButton({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  variant = "default",
  action,
  successMessage,
}: {
  trigger: React.ReactElement;
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: "default" | "destructive";
  action: () => Promise<ActionResult<unknown>>;
  successMessage?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await action();
      if (result.success) {
        toast.success(successMessage ?? "Done.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isPending}
            className={variant === "destructive" ? "bg-destructive hover:bg-destructive/90" : undefined}
          >
            {isPending ? "Please wait…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
