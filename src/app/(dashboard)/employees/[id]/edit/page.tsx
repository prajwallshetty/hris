import { forbidden, notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { can } from "@/server/rbac";
import { listCoordinators } from "@/server/queries/coordinators";
import { getEmployee } from "@/server/queries/employees";
import { getSessionUser } from "@/server/session";

import { EmployeeForm } from "../../employee-form";

function toDateInput(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!can(user, "update", "employee")) forbidden();

  const [employee, coordinators] = await Promise.all([getEmployee(user, id), listCoordinators(user)]);
  if (!employee) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={`Edit ${employee.fullName}`} />
      <EmployeeForm
        employeeId={employee.id}
        coordinators={coordinators}
        defaultValues={{
          fullName: employee.fullName,
          email: employee.email ?? "",
          phone: employee.phone ?? "",
          department: employee.department?.name ?? "",
          designation: employee.designation?.title ?? "",
          joiningDate: toDateInput(employee.joiningDate),
          coordinatorId: employee.coordinatorId ?? "",
          baseSalary: Number(employee.baseSalary),
          status: employee.status,
          bankName: employee.bankName ?? "",
          bankAccountIban: employee.bankAccountIban ?? "",
          notes: employee.notes ?? "",
        }}
      />
    </div>
  );
}
