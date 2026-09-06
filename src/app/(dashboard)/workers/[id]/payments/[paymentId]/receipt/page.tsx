import { notFound } from "next/navigation";
import Link from "next/link";

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

export default async function PaymentReceiptPage({
  params,
}: {
  params: Promise<{ id: string; paymentId: string }>;
}) {
  const { id, paymentId } = await params;
  const user = await getSessionUser();
  const result = await getWorkerPaymentReceipt(user, id, paymentId);
  if (!result) notFound();

  const { payment, outstanding } = result;
  const worker = payment.worker!;

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
            <p className="text-lg font-semibold">Manpower HRIS</p>
            <p className="text-muted-foreground text-sm">Payment Receipt</p>
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
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase">Payment Details</p>
            <p className="font-medium">{payment.paymentType.replaceAll("_", " ")}</p>
            <p className="text-muted-foreground">Method: {payment.method.replaceAll("_", " ")}</p>
            {payment.referenceNumber && <p className="text-muted-foreground">Reference: {payment.referenceNumber}</p>}
            {payment.workerPayroll && <p className="text-muted-foreground">Period: {payment.workerPayroll.payrollPeriod.name}</p>}
          </div>
        </div>

        <div className="space-y-2 border-t pt-6">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Amount Paid</span>
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

        <p className="text-muted-foreground mt-8 border-t pt-4 text-center text-xs">
          This receipt was generated automatically and reflects the payment record on file.
        </p>
      </div>
    </div>
  );
}
