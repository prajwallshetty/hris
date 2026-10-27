"use client";

import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { SupplierFormInput } from "@/lib/validation/manpower";
import { setSupplierStatus } from "@/server/actions/suppliers";

import { SupplierFormDialog } from "./supplier-form-dialog";

export function SupplierRowActions({
  supplierId,
  status,
  values,
  canEdit,
  canArchive,
}: {
  supplierId: string;
  status: "ACTIVE" | "INACTIVE";
  values: SupplierFormInput;
  canEdit: boolean;
  canArchive: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function toggleStatus() {
    startTransition(async () => {
      const next = status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      const result = await setSupplierStatus(supplierId, next);
      if (!result.success) return void toast.error(result.error);
      toast.success(next === "INACTIVE" ? "Supplier deactivated." : "Supplier reactivated.");
      router.refresh();
    });
  }

  if (!canEdit && !canArchive) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label="Supplier actions" disabled={isPending}>
              <MoreHorizontal className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-40">
          {canEdit && <DropdownMenuItem onClick={() => setEditOpen(true)}>Edit</DropdownMenuItem>}
          {canArchive && (
            <DropdownMenuItem onClick={toggleStatus}>{status === "ACTIVE" ? "Deactivate" : "Reactivate"}</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {canEdit && (
        <SupplierFormDialog supplierId={supplierId} defaultValues={values} open={editOpen} onOpenChange={setEditOpen} />
      )}
    </>
  );
}
