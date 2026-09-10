import { Users as UsersIcon } from "lucide-react";
import Link from "next/link";
import { forbidden } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can } from "@/server/rbac";
import { listAllClientsForSelect } from "@/server/queries/clients";
import { listCoordinators } from "@/server/queries/coordinators";
import { listUsers } from "@/server/queries/users";
import { getSessionUser } from "@/server/session";

import { CreateUserDialog } from "./create-user-dialog";
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

export default async function UsersPage() {
  const sessionUser = await getSessionUser();
  if (!can(sessionUser, "view", "user")) forbidden();
  const canManage = can(sessionUser, "update", "user");
  const canCreate = can(sessionUser, "create", "user");

  const [users, coordinators, clients] = await Promise.all([
    listUsers(sessionUser),
    canCreate ? listCoordinators(sessionUser) : Promise.resolve([]),
    canCreate ? listAllClientsForSelect() : Promise.resolve([]),
  ]);
  const coordinatorOptions = coordinators.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Administration" }, { label: "Users" }]}
        title="Users"
        description="System accounts and their access codes — the code itself is never shown after creation."
        actions={canCreate && <CreateUserDialog coordinators={coordinatorOptions} clients={clients} />}
      />

      {users.length === 0 ? (
        <EmptyState icon={UsersIcon} title="No users yet" description={canCreate ? "Add the first user account." : undefined} />
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
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    <Link href={`/users/${u.id}`} className="hover:underline">
                      {u.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>{ROLE_LABELS[u.role] ?? u.role}</TableCell>
                  <TableCell>{u.coordinator?.name ?? u.client?.companyName ?? "—"}</TableCell>
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
                          coordinatorId: u.coordinator?.id ?? "",
                          clientId: u.client?.id ?? "",
                        }}
                        coordinators={coordinatorOptions}
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
