import { Receipt } from "lucide-react";

import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SelectFilter } from "@/components/shared/select-filter";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EXPENSE_CATEGORIES } from "@/lib/validation/expense";
import { can } from "@/server/rbac";
import { archiveExpense } from "@/server/actions/expenses";
import { listClientHierarchyForSelect } from "@/server/queries/clients";
import { listCoordinators } from "@/server/queries/coordinators";
import { listExpenses } from "@/server/queries/expenses";
import { listWorkersForSelect } from "@/server/queries/workers";
import { getSessionUser } from "@/server/session";

import { ExpenseFormDialog } from "./expense-form-dialog";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

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

      {expenses.length === 0 ? (
        <EmptyState icon={Receipt} title="No expenses recorded yet" description={canCreate ? "Add one to get started." : undefined} />
      ) : (
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Linked To</TableHead>
                  <TableHead>Amount</TableHead>
                  {canArchive && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{formatDate(expense.date)}</TableCell>
                    <TableCell>{expense.category.replaceAll("_", " ")}</TableCell>
                    <TableCell>{expense.description ?? "—"}</TableCell>
                    <TableCell>
                      {[expense.worker?.fullName, expense.client?.companyName, expense.site?.name].filter(Boolean).join(" / ") || "—"}
                    </TableCell>
                    <TableCell className="font-medium">{formatMoney(expense.amount)}</TableCell>
                    {canArchive && (
                      <TableCell className="text-right">
                        <ConfirmActionButton
                          trigger={
                            <Button variant="ghost" size="sm">
                              Archive
                            </Button>
                          }
                          title="Archive this expense?"
                          description="It will no longer count toward profitability calculations."
                          confirmLabel="Archive"
                          variant="destructive"
                          action={archiveExpense.bind(null, expense.id)}
                          successMessage="Expense archived."
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} />
        </div>
      )}
    </div>
  );
}
