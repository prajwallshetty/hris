"use client";

import { Check, Copy, KeyRound } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { generateAccessCode } from "@/server/actions/users";

export function ResetAccessCodeButton({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [revealedCode, setRevealedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  async function handleConfirm() {
    setIsPending(true);
    try {
      const result = await generateAccessCode(userId);
      if (result.success) {
        setRevealedCode(result.data.accessCode);
        router.refresh();
      } else {
        toast.error(result.error);
        setOpen(false);
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={() => setOpen(true)}>
        <KeyRound className="size-4" />
        Reset Access Code
      </DropdownMenuItem>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setRevealedCode(null);
            setCopied(false);
          }
        }}
      >
        <AlertDialogContent>
          {revealedCode ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>New access code for {userName}</AlertDialogTitle>
                <AlertDialogDescription>
                  Share this now — it will not be shown again. Their previous code no longer works.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-4 py-3">
                <span className="font-mono text-lg font-semibold tracking-wide">{revealedCode}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(revealedCode);
                    setCopied(true);
                  }}
                >
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <AlertDialogFooter>
                <AlertDialogAction onClick={() => setOpen(false)}>Done</AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset the access code for {userName}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Their current code stops working immediately and a new one is generated.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirm} disabled={isPending}>
                  {isPending ? "Generating…" : "Reset Code"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
