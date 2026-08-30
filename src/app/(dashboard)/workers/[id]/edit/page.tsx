import { forbidden, notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { can } from "@/server/rbac";
import { listCoordinators } from "@/server/queries/workers";
import { getWorker } from "@/server/queries/workers";
import { getSessionUser } from "@/server/session";

import { WorkerForm } from "../../worker-form";

function toDateInput(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

export default async function EditWorkerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!can(user, "update", "worker")) forbidden();

  const [worker, coordinators] = await Promise.all([getWorker(user, id), listCoordinators()]);
  if (!worker) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={`Edit ${worker.fullName}`} description={`Iqama: ${worker.iqamaNumber}`} />
      <WorkerForm
        workerId={worker.id}
        coordinators={coordinators}
        defaultValues={{
          iqamaNumber: worker.iqamaNumber,
          fullName: worker.fullName,
          mobile: worker.mobile ?? "",
          passportNumber: worker.passportNumber ?? "",
          nationality: worker.nationality ?? "",
          dateOfBirth: toDateInput(worker.dateOfBirth),
          designation: worker.designation?.title ?? "",
          skillCategory: worker.skillCategory ?? "",
          joiningDate: toDateInput(worker.joiningDate),
          mobilizationDate: toDateInput(worker.mobilizationDate),
          demobilizationDate: toDateInput(worker.demobilizationDate),
          coordinatorId: worker.coordinatorId ?? "",
          hourlyRate: worker.hourlyRate ? Number(worker.hourlyRate) : undefined,
          overtimeRate: worker.overtimeRate ? Number(worker.overtimeRate) : undefined,
          status: worker.status,
          bankName: worker.bankName ?? "",
          bankAccountIban: worker.bankAccountIban ?? "",
          notes: worker.notes ?? "",
        }}
      />
    </div>
  );
}
