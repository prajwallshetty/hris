"use client";

import { Check, Copy, Plus } from "lucide-react";
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
import { createUser } from "@/server/actions/users";

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

export function CreateUserDialog({ coordinators, clients }: { coordinators: CoordinatorOption[]; clients: ClientOption[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("HR");
  const [coordinatorId, setCoordinatorId] = useState("");
  const [clientId, setClientId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revealedCode, setRevealedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  function reset() {
    setName("");
    setEmail("");
    setRole("HR");
    setCoordinatorId("");
    setClientId("");
    setRevealedCode(null);
    setCopied(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await createUser({
        name,
        email,
        role: role as never,
        coordinatorId,
        clientId,
      });
      if (result.success) {
        toast.success("User created.");
        setRevealedCode(result.data.accessCode);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleDone() {
    setOpen(false);
    reset();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <Plus className="size-4" />
            Add User
          </Button>
        }
      />
      <DialogContent className="max-w-sm">
        {revealedCode ? (
          <>
            <DialogHeader>
              <DialogTitle>Access code generated</DialogTitle>
              <DialogDescription>
                Share this with the user now — it will not be shown again. You can generate a new one later, but this exact
                code cannot be retrieved.
              </DialogDescription>
            </DialogHeader>
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
            <DialogFooter>
              <Button type="button" onClick={handleDone}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Add User</DialogTitle>
              <DialogDescription>An access code is generated automatically and shown once.</DialogDescription>
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
                Create User
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
