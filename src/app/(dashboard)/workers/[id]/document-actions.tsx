"use client";

import { Check, Loader2, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { deleteWorkerDocument, verifyWorkerDocument } from "@/server/actions/documents";

export function DocumentActions({ documentId, canVerify }: { documentId: string; canVerify: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function verify(status: "VERIFIED" | "REJECTED") {
    startTransition(async () => {
      const result = await verifyWorkerDocument(documentId, status);
      if (result.success) {
        toast.success(status === "VERIFIED" ? "Document verified." : "Document rejected.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteWorkerDocument(documentId);
      if (result.success) {
        toast.success("Document deleted.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {canVerify && (
        <>
          <Button size="icon-sm" variant="ghost" disabled={isPending} onClick={() => verify("VERIFIED")} title="Verify">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          </Button>
          <Button size="icon-sm" variant="ghost" disabled={isPending} onClick={() => verify("REJECTED")} title="Reject">
            <X className="size-4" />
          </Button>
        </>
      )}
      <Button size="icon-sm" variant="ghost" disabled={isPending} onClick={remove} title="Delete">
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
