import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SelectFilter } from "@/components/shared/select-filter";
import { EXPENSE_CATEGORIES } from "@/lib/validation/expense";
import { can } from "@/server/rbac";
import { listClientHierarchyForSelect } from "@/server/queries/clients";
import { listCoordinators } from "@/server/queries/coordinators";
import { listExpenses } from "@/server/queries/expenses";
import { listWorkersForSelect } from "@/server/queries/workers";
import { getSessionUser } from "@/server/session";

import { ExpenseFormDialog } from "./expense-form-dialog";
import { ExpensesTable, type ExpenseRow } from "./expenses-table";

function formatMoney(value: unknown) {
  return `SAR ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; page?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  const page = Number(params.page ?? 1) || 1;
  const canCreate = can(user, "create", "expense");
  const canArchive = can(user, "archive", "expense");

  const [{ expenses, total, pageSize }, clients, workers, coordinators] = await Promise.all([
    listExpenses(user, { category: (params.category as never) ?? "ALL", page }),
    canCreate ? listClientHierarchyForSelect() : Promise.resolve([]),
    canCreate ? listWorkersForSelect(user) : Promise.resolve([]),
    canCreate ? listCoordinators(user) : Promise.resolve([]),
  ]);

  const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const rows: ExpenseRow[] = expenses.map((e) => ({
    id: e.id,
    date: e.date.toISOString(),
    category: e.category,
    description: e.description,
    amount: Number(e.amount),
    workerId: e.workerId,
    workerName: e.worker?.fullName ?? null,
    clientId: e.clientId,
    clientName: e.client?.companyName ?? null,
    siteId: e.siteId,
    siteName: e.site?.name ?? null,
    coordinatorId: e.coordinatorId,
    coordinatorName: e.coordinatorName,
    department: e.departmentName,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Operations" }, { label: "Expenses" }]}
        title="Expenses"
        description="Transport, accommodation, recruitment, medical, and other company costs — linkable to a worker, client, site, or coordinator."
        actions={canCreate && <ExpenseFormDialog clients={clients} workers={workers} coordinators={coordinators} />}
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <SelectFilter
          paramKey="category"
          placeholder="Category"
          options={EXPENSE_CATEGORIES.map((c) => ({ label: c.replaceAll("_", " "), value: c }))}
        />
        <p className="text-muted-foreground text-sm">
          Total (this page): <span className="text-foreground font-medium">{formatMoney(totalAmount)}</span>
        </p>
      </div>

      <ExpensesTable
        rows={rows}
        clients={clients}
        workers={workers}
        coordinators={coordinators}
        canEdit={can(user, "update", "expense")}
        canArchive={canArchive}
      />

      {expenses.length > 0 && (
        <div className="rounded-lg border">
          <Pagination page={page} pageSize={pageSize} total={total} />
        </div>
      )}
    </div>
  );
}
