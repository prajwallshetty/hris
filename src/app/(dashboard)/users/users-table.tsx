"use client";

import { Download, Users as UsersIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toCsv } from "@/lib/csv";

import { UserRowActions } from "./user-row-actions";

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

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  accessCodeSetAt: Date | null;
  linkedTo: string | null;
  coordinatorId: string;
  clientId: string;
};

type CoordinatorOption = { id: string; name: string };
type ClientOption = { id: string; companyName: string };

/** Same client-side search/filter/export toolbar pattern used for
 * Clients/Coordinators/Expenses — Users had none of it (§91 audit): no
 * search, no role/status filter, no export. */
export function UsersTable({
  rows,
  canManage,
  coordinators,
  clients,
}: {
  rows: UserRow[];
  canManage: boolean;
  coordinators: CoordinatorOption[];
  clients: ClientOption[];
}) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (roleFilter !== "ALL" && r.role !== roleFilter) return false;
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q);
    });
  }, [rows, search, roleFilter, statusFilter]);

  function handleExport() {
    const csv = toCsv(
      ["Name", "Email", "Role", "Linked To", "Access Code", "Status"],
      filtered.map((u) => [
        u.name,
        u.email,
        ROLE_LABELS[u.role] ?? u.role,
        u.linkedTo ?? "",
        u.accessCodeSetAt ? "Set" : "Not set",
        u.status,
      ]),
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "users.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (rows.length === 0) {
    return <EmptyState icon={UsersIcon} title="No users yet" description={canManage ? "Add the first user account." : undefined} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
        <Input
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-xs"
        />
        <Select
          value={roleFilter}
          onValueChange={(v) => v && setRoleFilter(v)}
          items={[{ value: "ALL", label: "All roles" }, ...Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))]}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All roles</SelectItem>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => v && setStatusFilter(v)}
          items={[
            { value: "ALL", label: "All statuses" },
            { value: "ACTIVE", label: "Active" },
            { value: "INACTIVE", label: "Inactive" },
          ]}
        >
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="ml-auto" onClick={handleExport}>
          <Download className="size-4" />
          Export
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={UsersIcon} title="No users match your search" />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Linked To</TableHead>
                <TableHead>Access Code</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="w-10 text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    <Link href={`/users/${u.id}`} className="hover:underline">
                      {u.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>{ROLE_LABELS[u.role] ?? u.role}</TableCell>
                  <TableCell>{u.linkedTo ?? "—"}</TableCell>
                  <TableCell>
                    {u.accessCodeSetAt ? (
                      <Badge variant="secondary">Set</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Not set
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={u.status} />
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <UserRowActions
                        userId={u.id}
                        userName={u.name}
                        status={u.status}
                        defaultValues={{
                          name: u.name,
                          email: u.email,
                          role: u.role,
                          coordinatorId: u.coordinatorId,
                          clientId: u.clientId,
                        }}
                        coordinators={coordinators}
                        clients={clients}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
