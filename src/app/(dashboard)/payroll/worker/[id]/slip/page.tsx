import { notFound } from "next/navigation";
import Link from "next/link";

import { Logo } from "@/components/shared/logo";
import { PrintActions } from "@/components/shared/print-actions";
import { SendDocumentDialog } from "@/components/shared/send-document-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { getWorkerPayrollDetail } from "@/server/queries/payroll";
import { getSessionUser } from "@/server/session";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(date);
}

function formatMoney(value: unknown) {
  return `SAR ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function sumByType(items: { type: string; amount: unknown }[], type: string) {
  return items.filter((i) => i.type === type).reduce((sum, i) => sum + Number(i.amount), 0);
}

export default async function SalarySlipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const payroll = await getWorkerPayrollDetail(user, id);
  if (!payroll) notFound();

  const assignment = payroll.worker.assignments[0];
  const slipNumber = `SLIP-${payroll.id.slice(-8).toUpperCase()}`;

  const regular = sumByType(payroll.items, "REGULAR_HOURS");
  const overtime = sumByType(payroll.items, "OVERTIME");
  const allowances = sumByType(payroll.items, "ALLOWANCE");
  const bonus = sumByType(payroll.items, "BONUS");
  const totalEarnings = regular + overtime + allowances + bonus;

  const leave = sumByType(payroll.items, "LEAVE_DEDUCTION");
  const advance = sumByType(payroll.items, "ADVANCE_DEDUCTION");
  const loan = sumByType(payroll.items, "LOAN_DEDUCTION");
  const other = sumByType(payroll.items, "OTHER_DEDUCTION");
  const totalDeductions = leave + advance + loan + other;

  const paid = payroll.payments.filter((p) => !p.voidedAt).reduce((sum, p) => sum + Number(p.amount), 0);
  const netPayable = Number(payroll.netPayable);
  const paymentStatus = paid <= 0 ? "UNPAID" : paid >= netPayable ? "PAID" : "PARTIALLY_PAID";

  const message = `Hello ${payroll.worker.fullName},\n\nYour salary slip for ${payroll.payrollPeriod.name} from Expand Arabia is ready.\n\nNet Salary: ${formatMoney(netPayable)}\nPaid: ${formatMoney(paid)}\nOutstanding: ${formatMoney(netPayable - paid)}\n\nThank you,\nExpand Arabia`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/payroll/worker/${payroll.id}`} className="text-muted-foreground text-sm hover:underline">
          ← Back to {payroll.worker.fullName}
        </Link>
        <div className="flex items-center gap-2">
          <SendDocumentDialog
            documentLabel={`Salary Slip — ${payroll.payrollPeriod.name}`}
            documentUrl={`/payroll/worker/${payroll.id}/slip`}
            recipientName={payroll.worker.fullName}
            mobileNumber={payroll.worker.mobile ?? undefined}
            emailSubject={`Salary Slip — ${payroll.worker.fullName} — ${payroll.payrollPeriod.name}`}
            message={message}
          />
          <PrintActions />
        </div>
      </div>

      <div className="rounded-xl border bg-white p-8 shadow-sm print:border-none print:shadow-none">
        <div className="flex items-start justify-between border-b pb-6">
          <div>
            <Logo size="document" className="mb-2" />
            <p className="text-muted-foreground text-sm">Salary Slip</p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground text-xs font-medium uppercase">Slip No.</p>
            <p className="font-mono text-lg font-semibold">{slipNumber}</p>
            <p className="text-muted-foreground text-xs">Date: {formatDate(new Date())}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 py-6 text-sm">
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase">Employee</p>
            <p className="font-medium">{payroll.worker.fullName}</p>
            <p className="text-muted-foreground">Iqama: {payroll.worker.iqamaNumber}</p>
            {payroll.worker.designation && <p className="text-muted-foreground">{payroll.worker.designation.title}</p>}
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase">Assignment</p>
            <p className="text-muted-foreground">Client: {assignment?.client.companyName ?? "—"}</p>
            <p className="text-muted-foreground">Site: {assignment?.site.name ?? "—"}</p>
            <p className="text-muted-foreground">Salary Period: {payroll.payrollPeriod.name}</p>
          </div>
        </div>

        <div className="border-t pt-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs font-medium uppercase">
                <th className="pb-2" colSpan={2}>
                  Earnings
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2">Regular Salary</td>
                <td className="py-2 text-right tabular-nums">{formatMoney(regular)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2">Overtime</td>
                <td className="py-2 text-right tabular-nums">{formatMoney(overtime)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2">Allowances</td>
                <td className="py-2 text-right tabular-nums">{formatMoney(allowances)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2">Bonus</td>
                <td className="py-2 text-right tabular-nums">{formatMoney(bonus)}</td>
              </tr>
              <tr className="font-semibold">
                <td className="py-2">Total Earnings</td>
                <td className="py-2 text-right tabular-nums">{formatMoney(totalEarnings)}</td>
              </tr>
            </tbody>
          </table>

          <table className="mt-6 w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs font-medium uppercase">
                <th className="pb-2" colSpan={2}>
                  Deductions
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2">Leave</td>
                <td className="py-2 text-right tabular-nums">{formatMoney(leave)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2">Advance</td>
                <td className="py-2 text-right tabular-nums">{formatMoney(advance)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2">Loan</td>
                <td className="py-2 text-right tabular-nums">{formatMoney(loan)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2">Other</td>
                <td className="py-2 text-right tabular-nums">{formatMoney(other)}</td>
              </tr>
              <tr className="font-semibold">
                <td className="py-2">Total Deductions</td>
                <td className="py-2 text-right tabular-nums">{formatMoney(totalDeductions)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex items-center justify-between border-t pt-6">
          <span className="text-lg font-semibold">Net Salary</span>
          <span className="text-xl font-semibold tabular-nums">{formatMoney(netPayable)}</span>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Payment Status</span>
          <StatusBadge status={paymentStatus} />
        </div>

        <div className="mt-10 grid grid-cols-2 gap-6 text-sm">
          <div>
            <div className="border-foreground/40 h-12 border-b" />
            <p className="text-muted-foreground mt-1 text-xs">Employee Signature</p>
          </div>
          <div>
            <div className="border-foreground/40 h-12 border-b" />
            <p className="text-muted-foreground mt-1 text-xs">Authorized Signature</p>
          </div>
        </div>

        <p className="text-muted-foreground mt-8 border-t pt-4 text-center text-xs">
          This salary slip was generated automatically from the payroll record on file.
        </p>
      </div>
    </div>
  );
}
