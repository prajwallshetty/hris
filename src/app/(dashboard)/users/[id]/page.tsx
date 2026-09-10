import { MoreHorizontal } from "lucide-react";
import { forbidden, notFound } from "next/navigation";

import { KpiCard } from "@/components/shared/kpi-card";
import { RecordAvatarInitials, RecordHeader } from "@/components/shared/record-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Timeline, type TimelineItem } from "@/components/shared/timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can } from "@/server/rbac";
import { listAllClientsForSelect } from "@/server/queries/clients";
import { listCoordinators } from "@/server/queries/coordinators";
import { getUser, listUserAuthAttempts } from "@/server/queries/users";
import { getSessionUser } from "@/server/session";

import { EditUserDialog } from "../edit-user-dialog";
import { ResetAccessCodeButton } from "../reset-access-code-button";
import { UserStatusButton } from "../user-status-button";

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

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionUser = await getSessionUser();
  if (!can(sessionUser, "view", "user")) forbidden();

  const canManage = can(sessionUser, "update", "user");
  const canCreate = can(sessionUser, "create", "user");

  const [user, authAttempts, coordinators, clients] = await Promise.all([
    getUser(sessionUser, id),
    listUserAuthAttempts(sessionUser, id),
    canCreate ? listCoordinators(sessionUser) : Promise.resolve([]),
    canCreate ? listAllClientsForSelect() : Promise.resolve([]),
  ]);
  if (!user) notFound();

  const linkedTo =
    user.role === "COORDINATOR"
      ? (coordinators.find((c) => c.id === user.coordinatorId)?.name ?? "—")
      : user.role === "CLIENT"
        ? (clients.find((c) => c.id === user.clientId)?.companyName ?? "—")
        : "—";

  const activityItems: TimelineItem[] = authAttempts.map((attempt) => ({
    id: attempt.id,
    title: attempt.success ? "Successful sign-in" : `Failed sign-in attempt${attempt.reason ? ` — ${attempt.reason}` : ""}`,
    timestamp: attempt.createdAt,
    tone: attempt.success ? "success" : "destructive",
  }));

  return (
    <div className="space-y-6">
      <RecordHeader
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Administration" },
          { label: "Users", href: "/users" },
          { label: user.name },
        ]}
        avatar={<RecordAvatarInitials name={user.name} />}
        title={user.name}
        badges={
          <>
            <StatusBadge status={user.status} />
            <Badge variant="outline">{ROLE_LABELS[user.role] ?? user.role}</Badge>
          </>
        }
        meta={<span>{user.email}</span>}
        actions={
          canManage && (
            <>
              <EditUserDialog
                userId={user.id}
                defaultValues={{
                  name: user.name,
                  email: user.email,
                  role: user.role,
                  coordinatorId: user.coordinatorId ?? "",
                  clientId: user.clientId ?? "",
                }}
                coordinators={coordinators.map((c) => ({ id: c.id, name: c.name }))}
                clients={clients}
              />
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" size="icon">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <ResetAccessCodeButton userId={user.id} userName={user.name} />
                  <UserStatusButton userId={user.id} userName={user.name} status={user.status} />
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Role" value={ROLE_LABELS[user.role] ?? user.role} />
        <KpiCard label="Linked To" value={linkedTo} />
        <KpiCard label="Access Code" value={user.accessCodeSetAt ? "Set" : "Not Set"} />
        <KpiCard label="Account Created" value={formatDateTime(user.createdAt).split(",")[0]} />
      </div>

      <div className="rounded-lg border p-4">
        <p className="mb-3 text-sm font-medium">Recent Sign-In Activity</p>
        {authAttempts.length === 0 ? (
          <p className="text-muted-foreground text-sm">No sign-in attempts recorded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {authAttempts.map((attempt) => (
                  <TableRow key={attempt.id}>
                    <TableCell>{formatDateTime(attempt.createdAt)}</TableCell>
                    <TableCell>
                      <StatusBadge status={attempt.success ? "APPROVED" : "REJECTED"} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{attempt.ipAddress ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{attempt.reason ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="rounded-lg border p-4">
        <p className="mb-3 text-sm font-medium">Activity Timeline</p>
        <Timeline items={activityItems} emptyMessage="No activity recorded yet" />
      </div>
    </div>
  );
}
