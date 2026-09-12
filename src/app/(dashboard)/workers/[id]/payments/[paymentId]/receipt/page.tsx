import { notFound } from "next/navigation";
import Link from "next/link";

import { Logo } from "@/components/shared/logo";
import { formatReceiptNumber, formatWorkerCode } from "@/lib/codes";
import { getWorkerPaymentReceipt } from "@/server/queries/worker-detail";
import { getSessionUser } from "@/server/session";

import { ReceiptActions } from "./receipt-actions";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(date);
}

function formatMoney(value: unknown) {
  return `SAR ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function LineItem({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className={emphasis ? "font-medium" : "text-muted-foreground"}>{label}</span>
      <span className={emphasis ? "font-semibold tabular-nums" : "tabular-nums"}>{value}</span>
    </div>
  );
}

export default async function PaymentReceiptPage({
  params,
}: {
  params: Promise<{ id: string; paymentId: string }>;
}) {
  const { id, paymentId } = await params;
  const user = await getSessionUser();
  const result = await getWorkerPaymentReceipt(user, id, paymentId);
  if (!result) notFound();

  const { payment, outstanding, currentAssignment } = result;
  const worker = payment.worker!;
  const payroll = payment.workerPayroll;

  const totalPaidOnPayroll = payroll ? payroll.payments.reduce((sum, p) => sum + Number(p.amount), 0) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/workers/${worker.id}`} className="text-muted-foreground text-sm hover:underline">
          ← Back to {worker.fullName}
        </Link>
        <ReceiptActions />
      </div>

      <div className="rounded-xl border bg-white p-8 shadow-sm print:border-none print:shadow-none">
        <div className="flex items-start justify-between border-b pb-6">
          <div>
            <Logo size="document" className="mb-2" />
            <p className="text-muted-foreground text-sm">Salary Payment Receipt</p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground text-xs font-medium uppercase">Receipt No.</p>
            <p className="font-mono text-lg font-semibold">{formatReceiptNumber(payment.sequenceNo)}</p>
            <p className="text-muted-foreground text-xs">{formatDate(payment.date)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 py-6 text-sm">
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase">Paid To</p>
            <p className="font-medium">{worker.fullName}</p>
            <p className="text-muted-foreground">Worker ID: {formatWorkerCode(worker.sequenceNo)}</p>
            <p className="text-muted-foreground">Iqama: {worker.iqamaNumber}</p>
            {worker.designation && <p className="text-muted-foreground">Designation: {worker.designation.title}</p>}
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase">Payment Details</p>
            <p className="font-medium">{payment.paymentType.replaceAll("_", " ")}</p>
            <p className="text-muted-foreground">Method: {payment.method.replaceAll("_", " ")}</p>
            {payment.referenceNumber && <p className="text-muted-foreground">Reference: {payment.referenceNumber}</p>}
            {payroll && <p className="text-muted-foreground">Period: {payroll.payrollPeriod.name}</p>}
            {currentAssignment && (
              <p className="text-muted-foreground">
                {currentAssignment.client.companyName} / {currentAssignment.site.name}
              </p>
            )}
          </div>
        </div>

        {payroll && (
          <div className="space-y-3 border-t py-6 text-sm">
            <p className="text-muted-foreground text-xs font-medium uppercase">Salary Breakdown</p>
            <div className="space-y-0.5">
              <LineItem
                label={`Regular Hours (${Number(payroll.regularHours).toFixed(1)} × ${formatMoney(payroll.regularRate)})`}
                value={formatMoney(Number(payroll.regularHours) * Number(payroll.regularRate))}
              />
              {Number(payroll.overtimeHours) > 0 && (
                <LineItem
                  label={`Overtime (${Number(payroll.overtimeHours).toFixed(1)} × ${formatMoney(payroll.overtimeRate)})`}
                  value={formatMoney(Number(payroll.overtimeHours) * Number(payroll.overtimeRate))}
                />
              )}
              {Number(payroll.allowances) > 0 && <LineItem label="Allowances" value={formatMoney(payroll.allowances)} />}
              {Number(payroll.bonuses) > 0 && <LineItem label="Bonuses" value={formatMoney(payroll.bonuses)} />}
              <LineItem label="Gross Pay" value={formatMoney(payroll.grossPay)} emphasis />
            </div>
            <div className="space-y-0.5 border-t pt-2">
              {Number(payroll.advanceDeduction) > 0 && (
                <LineItem label="Advance Deduction" value={`- ${formatMoney(payroll.advanceDeduction)}`} />
              )}
              {Number(payroll.loanDeduction) > 0 && (
                <LineItem label="Loan Deduction" value={`- ${formatMoney(payroll.loanDeduction)}`} />
              )}
              {Number(payroll.leaveDeduction) > 0 && (
                <LineItem label="Leave Deduction" value={`- ${formatMoney(payroll.leaveDeduction)}`} />
              )}
              {Number(payroll.otherDeductions) > 0 && (
                <LineItem label="Other Deductions" value={`- ${formatMoney(payroll.otherDeductions)}`} />
              )}
              <LineItem label="Net Salary" value={formatMoney(payroll.netPayable)} emphasis />
            </div>
            {totalPaidOnPayroll !== null && (
              <div className="space-y-0.5 border-t pt-2">
                <LineItem label="Total Paid to Date (this period)" value={formatMoney(totalPaidOnPayroll)} />
              </div>
            )}
          </div>
        )}

        <div className="space-y-2 border-t pt-6">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Amount Paid (this transaction)</span>
            <span className="text-xl font-semibold tabular-nums">{formatMoney(payment.amount)}</span>
          </div>
          {outstanding !== null && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Remaining Balance</span>
              <span className={`text-sm font-medium tabular-nums ${outstanding > 0 ? "text-warning-foreground" : "text-success"}`}>
                {formatMoney(outstanding)}
              </span>
            </div>
          )}
        </div>

        {payment.remarks && (
          <div className="mt-6 border-t pt-4 text-sm">
            <p className="text-muted-foreground text-xs font-medium uppercase">Notes</p>
            <p>{payment.remarks}</p>
          </div>
        )}

        <div className="mt-10 grid grid-cols-2 gap-6 text-sm">
          <div>
            <div className="border-foreground/40 h-12 border-b" />
            <p className="text-muted-foreground mt-1 text-xs">Worker Signature</p>
          </div>
          <div>
            <div className="border-foreground/40 h-12 border-b" />
            <p className="text-muted-foreground mt-1 text-xs">Authorized Signature</p>
          </div>
        </div>

        <p className="text-muted-foreground mt-8 border-t pt-4 text-center text-xs">
          This receipt was generated automatically and reflects the payment record on file.
        </p>
      </div>
    </div>
  );
}
