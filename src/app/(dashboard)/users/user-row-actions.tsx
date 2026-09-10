"use client";

import { MoreHorizontal, Pencil } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { EditUserDialog } from "./edit-user-dialog";
import { ResetAccessCodeButton } from "./reset-access-code-button";
import { UserStatusButton } from "./user-status-button";

type CoordinatorOption = { id: string; name: string };
type ClientOption = { id: string; companyName: string };

/** Row "…" menu for the Users list — View / Edit / Reset Code / Disable.
 * Edit is driven by local state rather than nesting EditUserDialog's
 * trigger inside a DropdownMenuItem, matching the pattern already proven
 * safe by ResetAccessCodeButton/UserStatusButton elsewhere in this menu. */
export function UserRowActions({
  userId,
  userName,
  defaultValues,
  coordinators,
  clients,
  status,
}: {
  userId: string;
  userName: string;
  defaultValues: { name: string; email: string; role: string; coordinatorId: string; clientId: string };
  coordinators: CoordinatorOption[];
  clients: ClientOption[];
  status: string;
}) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${userName}`}>
              <MoreHorizontal className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link href={`/users/${userId}`}>View</Link>} />
          <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" />
            Edit
          </DropdownMenuItem>
          <ResetAccessCodeButton userId={userId} userName={userName} />
          <UserStatusButton userId={userId} userName={userName} status={status} />
        </DropdownMenuContent>
      </DropdownMenu>

      <EditUserDialog
        userId={userId}
        defaultValues={defaultValues}
        coordinators={coordinators}
        clients={clients}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}
