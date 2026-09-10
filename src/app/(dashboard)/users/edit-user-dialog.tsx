"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { USER_ROLES } from "@/lib/validation/user";
import { updateUser } from "@/server/actions/users";

type CoordinatorOption = { id: string; name: string };
type ClientOption = { id: string; companyName: string };

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  HR: "HR",
  ACCOUNTS: "Accounts",
  MANAGER: "Manager",
  COORDINATOR: "Coordinator",
  CLIENT: "Client",
  EMPLOYEE: "Employee",
};

export function EditUserDialog({
  userId,
  defaultValues,
  coordinators,
  clients,
  trigger,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  userId: string;
  defaultValues: { name: string; email: string; role: string; coordinatorId: string; clientId: string };
  coordinators: CoordinatorOption[];
  clients: ClientOption[];
  trigger?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChangeProp ?? setInternalOpen;
  const [name, setName] = useState(defaultValues.name);
  const [email, setEmail] = useState(defaultValues.email);
  const [role, setRole] = useState(defaultValues.role);
  const [coordinatorId, setCoordinatorId] = useState(defaultValues.coordinatorId);
  const [clientId, setClientId] = useState(defaultValues.clientId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await updateUser(userId, { name, email, role: role as never, coordinatorId, clientId });
      if (result.success) {
        toast.success("User updated.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger render={trigger} />}
      {!trigger && !onOpenChangeProp && (
        <DialogTrigger
          render={
            <Button variant="outline">
              <Pencil className="size-4" />
              Edit
            </Button>
          }
        />
      )}
      <DialogContent className="max-w-sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>The access code itself is managed separately via Reset Access Code.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Field>
              <FieldLabel htmlFor="name">Name *</FieldLabel>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email *</FieldLabel>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field>
              <FieldLabel>Role *</FieldLabel>
              <Select value={role} onValueChange={(v) => v && setRole(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USER_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {role === "COORDINATOR" && (
              <Field>
                <FieldLabel>Coordinator *</FieldLabel>
                <Select value={coordinatorId} onValueChange={(v) => v && setCoordinatorId(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a coordinator" />
                  </SelectTrigger>
                  <SelectContent>
                    {coordinators.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            {role === "CLIENT" && (
              <Field>
                <FieldLabel>Client *</FieldLabel>
                <Select value={clientId} onValueChange={(v) => v && setClientId(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.companyName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
