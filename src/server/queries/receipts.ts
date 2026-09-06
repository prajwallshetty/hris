import { db } from "@/lib/db";
import { formatEmployeeCode, formatWorkerCode } from "@/lib/codes";
import { generateUniqueReceiptNumber } from "@/lib/receipt-number";
import { assertCan, type SessionUser } from "@/server/rbac";

export type ReceiptData = {
  receiptNumber: string;
  paymentId: string;
  paymentDate: Date;
  recipientType: "WORKER" | "EMPLOYEE";
  recipientName: string;
  recipientCode: string;
  iqamaOrId: string;
  designation: string;
  mobileNumber: string;
  clientOrDepartment: string;
  siteName: string;
  payrollPeriodName: string;
  payrollPeriodStart: Date | null;
  payrollPeriodEnd: Date | null;

  regularHours: number;
  overtimeHours: number;
  regularRate: number;
  overtimeRate: number;
  basicSalaryOrRegularPay: number;
  overtimePay: number;
  allowances: number;
  bonuses: number;
  grossPay: number;

  advanceDeduction: number;
  loanDeduction: number;
  leaveDeduction: number;
  otherDeductions: number;

  netPayable: number;
  amountPaidThisTransaction: number;
  totalAmountPaid: number;
  remainingOutstanding: number;

  paymentMethod: string;
  referenceNumber: string | null;
  remarks: string | null;
  createdAt: Date;
};

export async function getPaymentReceiptData(paymentId: string, user: SessionUser): Promise<ReceiptData | null> {
  assertCan(user, "view", "workerPayment");

  const payment = await db.workerPayment.findUnique({
    where: { id: paymentId },
    include: {
      worker: {
        include: {
          designation: true,
          assignments: {
            where: { status: "ACTIVE" },
            include: { client: true, site: true },
            orderBy: { startDate: "desc" },
            take: 1,
          },
        },
      },
      employee: {
        include: {
          designation: true,
          department: true,
        },
      },
      workerPayroll: {
        include: {
          payrollPeriod: true,
          payments: true,
        },
      },
      employeePayroll: {
        include: {
          payrollPeriod: true,
          payments: true,
        },
      },
    },
  });

  if (!payment) return null;

  // Auto-backfill receiptNumber for legacy payments if missing
  let receiptNumber = payment.receiptNumber;
  if (!receiptNumber) {
    receiptNumber = await generateUniqueReceiptNumber(payment.date.getFullYear());
    await db.workerPayment.update({
      where: { id: payment.id },
      data: { receiptNumber },
    });
  }

  const isWorker = !!payment.workerId || !!payment.worker;

  if (isWorker && payment.worker) {
    const w = payment.worker;
    const activeAssignment = w.assignments[0];
    const wp = payment.workerPayroll;
    const allPayments = wp?.payments ?? [payment];
    const totalPaid = allPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const netPayable = wp ? Number(wp.netPayable) : Number(payment.amount);
    const remainingOutstanding = Math.max(0, netPayable - totalPaid);

    const regularHours = wp ? Number(wp.regularHours) : 0;
    const overtimeHours = wp ? Number(wp.overtimeHours) : 0;
    const regularRate = wp ? Number(wp.regularRate) : 0;
    const overtimeRate = wp ? Number(wp.overtimeRate) : 0;
    const basicPay = regularHours * regularRate;
    const overtimePay = overtimeHours * overtimeRate;

    return {
      receiptNumber,
      paymentId: payment.id,
      paymentDate: payment.date,
      recipientType: "WORKER",
      recipientName: w.fullName,
      recipientCode: formatWorkerCode(w.sequenceNo),
      iqamaOrId: w.iqamaNumber,
      designation: w.designation?.title ?? "—",
      mobileNumber: w.mobile ?? "",
      clientOrDepartment: activeAssignment?.client.companyName ?? "—",
      siteName: activeAssignment?.site.name ?? "—",
      payrollPeriodName: wp?.payrollPeriod.name ?? "Direct Payment",
      payrollPeriodStart: wp?.payrollPeriod.periodStart ?? null,
      payrollPeriodEnd: wp?.payrollPeriod.periodEnd ?? null,

      regularHours,
      overtimeHours,
      regularRate,
      overtimeRate,
      basicSalaryOrRegularPay: basicPay,
      overtimePay,
      allowances: wp ? Number(wp.allowances) : 0,
      bonuses: wp ? Number(wp.bonuses) : 0,
      grossPay: wp ? Number(wp.grossPay) : Number(payment.amount),

      advanceDeduction: wp ? Number(wp.advanceDeduction) : 0,
      loanDeduction: wp ? Number(wp.loanDeduction) : 0,
      leaveDeduction: wp ? Number(wp.leaveDeduction) : 0,
      otherDeductions: wp ? Number(wp.otherDeductions) : 0,

      netPayable,
      amountPaidThisTransaction: Number(payment.amount),
      totalAmountPaid: totalPaid,
      remainingOutstanding,

      paymentMethod: payment.method,
      referenceNumber: payment.referenceNumber,
      remarks: payment.remarks,
      createdAt: payment.createdAt,
    };
  } else if (payment.employee) {
    const e = payment.employee;
    const ep = payment.employeePayroll;
    const allPayments = ep?.payments ?? [payment];
    const totalPaid = allPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const netPayable = ep ? Number(ep.netPayable) : Number(payment.amount);
    const remainingOutstanding = Math.max(0, netPayable - totalPaid);

    return {
      receiptNumber,
      paymentId: payment.id,
      paymentDate: payment.date,
      recipientType: "EMPLOYEE",
      recipientName: e.fullName,
      recipientCode: formatEmployeeCode(e.sequenceNo),
      iqamaOrId: e.phone ?? "—",
      designation: e.designation?.title ?? "—",
      mobileNumber: e.phone ?? "",
      clientOrDepartment: e.department?.name ?? "—",
      siteName: "Head Office",
      payrollPeriodName: ep?.payrollPeriod.name ?? "Direct Payment",
      payrollPeriodStart: ep?.payrollPeriod.periodStart ?? null,
      payrollPeriodEnd: ep?.payrollPeriod.periodEnd ?? null,

      regularHours: 0,
      overtimeHours: 0,
      regularRate: 0,
      overtimeRate: 0,
      basicSalaryOrRegularPay: ep ? Number(ep.baseSalary) : Number(payment.amount),
      overtimePay: 0,
      allowances: ep ? Number(ep.allowances) : 0,
      bonuses: ep ? Number(ep.bonuses) : 0,
      grossPay: ep ? Number(ep.baseSalary) + Number(ep.allowances) + Number(ep.bonuses) : Number(payment.amount),

      advanceDeduction: ep ? Number(ep.advanceDeduction) : 0,
      loanDeduction: ep ? Number(ep.loanDeduction) : 0,
      leaveDeduction: ep ? Number(ep.leaveDeduction) : 0,
      otherDeductions: ep ? Number(ep.otherDeductions) : 0,

      netPayable,
      amountPaidThisTransaction: Number(payment.amount),
      totalAmountPaid: totalPaid,
      remainingOutstanding,

      paymentMethod: payment.method,
      referenceNumber: payment.referenceNumber,
      remarks: payment.remarks,
      createdAt: payment.createdAt,
    };
  }

  return null;
}
