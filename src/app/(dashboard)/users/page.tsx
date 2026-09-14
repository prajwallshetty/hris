import { forbidden } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { can } from "@/server/rbac";
import { listAllClientsForSelect } from "@/server/queries/clients";
import { listCoordinators } from "@/server/queries/coordinators";
import { listUsers } from "@/server/queries/users";
import { getSessionUser } from "@/server/session";

import { CreateUserDialog } from "./create-user-dialog";
import { UsersTable, type UserRow } from "./users-table";

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

  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    accessCodeSetAt: u.accessCodeSetAt,
    linkedTo: u.coordinator?.name ?? u.client?.companyName ?? null,
    coordinatorId: u.coordinator?.id ?? "",
    clientId: u.client?.id ?? "",
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Administration" }, { label: "Users" }]}
        title="Users"
        description="System accounts and their access codes — the code itself is never shown after creation."
        actions={canCreate && <CreateUserDialog coordinators={coordinatorOptions} clients={clients} />}
      />

      <UsersTable rows={rows} canManage={canManage} coordinators={coordinatorOptions} clients={clients} />
    </div>
  );
}
