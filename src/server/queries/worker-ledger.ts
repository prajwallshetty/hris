import { db } from "@/lib/db";
import { assertCan, type SessionUser } from "@/server/rbac";

// A worker's complete financial history in one chronological, transaction-
// based ledger. Every row here is derived directly from an existing DB
// record (WorkerPayroll/WorkerPayment/Advance(Repayment)/Loan(Repayment)/
// SalaryAdjustment/WorkerRecurringChargeDeduction) — nothing is stored or
// hand-edited as a "balance", and the running balance is always recomputed
// from the full transaction list (§ VERY IMPORTANT: never manually
// overwrite historical balances).
//
// Sign convention (Debit/Credit, "balance" = net amount currently owed BY
// the company TO the worker):
//   - "Salary payable" is credited at the payroll's NET payable (after every
//     payroll-time deduction — advance/loan recovery, leave, other — is
//     already netted in, exactly as shown everywhere else in the app).
//   - "Advance issued" / "Loan issued" debit the full amount at disbursement
//     (real cash paid out ahead of being earned).
//   - "Advance recovery" / "Loan deduction" are credited at the recovered
//     amount when a payroll run applies a repayment — this is what restores
//     the balance that "Salary payable" (net) already reduced, so recovering
//     a $500 advance across payroll never double-counts against the $500
//     debited when it was issued.
//   - "Salary payment" debits actual cash paid to the worker.
//   - "Bonus"/"Deduction"/"Correction" (SalaryAdjustment) and recurring
//     charge deductions (rent/housing/etc.) are independent of any prior
//     issuance, so they simply credit/debit the balance directly.
export type WorkerLedgerType =
  | "SALARY_PAYABLE"
  | "SALARY_PAYMENT"
  | "ADVANCE_ISSUED"
  | "ADVANCE_RECOVERY"
  | "LOAN_ISSUED"
  | "LOAN_RECOVERY"
  | "BONUS"
  | "DEDUCTION"
  | "CORRECTION"
  | "RECURRING_CHARGE"
  | "FINAL_SETTLEMENT"
  | "VOIDED_PAYMENT";

export type WorkerLedgerEntry = {
  id: string;
  date: Date;
  type: WorkerLedgerType;
  description: string;
  debit: number;
  credit: number;
  reference: string | null;
  payrollPeriodId: string | null;
  payrollPeriodName: string | null;
  clientId: string | null;
  clientName: string | null;
  siteId: string | null;
  siteName: string | null;
  balance: number;
};

const FINALIZED_PAYROLL_STATUSES = new Set(["APPROVED", "PAID", "PARTIALLY_PAID"]);

const PAYMENT_TYPE_LABEL: Record<string, string> = {
  SALARY: "Salary payment",
  ADVANCE: "Advance payment",
  LOAN: "Loan payment",
  SETTLEMENT: "Final settlement",
  ADJUSTMENT: "Adjustment payment",
  OTHER: "Other payment",
};

export async function getWorkerLedger(user: SessionUser, workerId: string): Promise<WorkerLedgerEntry[]> {
  assertCan(user, "view", "workerPayment");

  const [payrolls, payments, advances, loans, advanceRepayments, loanRepayments, adjustments, chargeDeductions] =
    await Promise.all([
      db.workerPayroll.findMany({
        where: { workerId, status: { in: Array.from(FINALIZED_PAYROLL_STATUSES) } as never },
        include: { payrollPeriod: true },
      }),
      db.workerPayment.findMany({
        where: { workerId },
        include: { workerPayroll: { include: { payrollPeriod: true } } },
      }),
      db.advance.findMany({ where: { workerId } }),
      db.loan.findMany({ where: { workerId } }),
      db.advanceRepayment.findMany({ where: { advance: { workerId } }, include: { advance: true } }),
      db.loanRepayment.findMany({ where: { loan: { workerId } }, include: { loan: true } }),
      db.salaryAdjustment.findMany({ where: { workerId }, include: { payrollPeriod: true } }),
      db.workerRecurringChargeDeduction.findMany({ where: { charge: { workerId } }, include: { charge: true } }),
    ]);

  const assignmentIds = [...new Set(payrolls.map((p) => p.assignmentId).filter((id): id is string => !!id))];
  const assignments = assignmentIds.length
    ? await db.assignment.findMany({
        where: { id: { in: assignmentIds } },
        include: { client: true, site: true },
      })
    : [];
  const assignmentById = new Map(assignments.map((a) => [a.id, a]));

  const entries: Omit<WorkerLedgerEntry, "balance">[] = [];

  for (const p of payrolls) {
    const assignment = p.assignmentId ? assignmentById.get(p.assignmentId) : undefined;
    entries.push({
      id: `payroll-${p.id}`,
      date: p.payrollPeriod.periodEnd,
      type: "SALARY_PAYABLE",
      description: `Salary payable — ${p.payrollPeriod.name}`,
      debit: 0,
      credit: Number(p.netPayable),
      reference: p.payrollPeriod.name,
      payrollPeriodId: p.payrollPeriodId,
      payrollPeriodName: p.payrollPeriod.name,
      clientId: assignment?.clientId ?? null,
      clientName: assignment?.client.companyName ?? null,
      siteId: assignment?.siteId ?? null,
      siteName: assignment?.site.name ?? null,
    });
  }

  for (const p of payments) {
    entries.push({
      id: `payment-${p.id}`,
      date: p.date,
      type: p.paymentType === "SETTLEMENT" ? "FINAL_SETTLEMENT" : "SALARY_PAYMENT",
      description: `${PAYMENT_TYPE_LABEL[p.paymentType] ?? "Payment"}${p.workerPayroll ? ` — ${p.workerPayroll.payrollPeriod.name}` : ""}`,
      debit: Number(p.amount),
      credit: 0,
      reference: p.referenceNumber,
      payrollPeriodId: p.workerPayrollId,
      payrollPeriodName: p.workerPayroll?.payrollPeriod.name ?? null,
      clientId: null,
      clientName: null,
      siteId: null,
      siteName: null,
    });

    // Voiding never deletes the original debit above (full audit trail) —
    // it adds a compensating credit at the void date instead, so the
    // running balance is correct from that point forward without ever
    // rewriting the historical payment entry (§ never overwrite history).
    if (p.voidedAt) {
      entries.push({
        id: `payment-void-${p.id}`,
        date: p.voidedAt,
        type: "VOIDED_PAYMENT",
        description: `Payment voided${p.voidReason ? ` — ${p.voidReason}` : ""}`,
        debit: 0,
        credit: Number(p.amount),
        reference: p.referenceNumber,
        payrollPeriodId: p.workerPayrollId,
        payrollPeriodName: p.workerPayroll?.payrollPeriod.name ?? null,
        clientId: null,
        clientName: null,
        siteId: null,
        siteName: null,
      });
    }
  }

  for (const a of advances) {
    entries.push({
      id: `advance-${a.id}`,
      date: a.dateGiven,
      type: "ADVANCE_ISSUED",
      description: `Advance issued${a.reason ? ` — ${a.reason}` : ""}`,
      debit: Number(a.amount),
      credit: 0,
      reference: a.id,
      payrollPeriodId: null,
      payrollPeriodName: null,
      clientId: null,
      clientName: null,
      siteId: null,
      siteName: null,
    });
  }

  for (const l of loans) {
    entries.push({
      id: `loan-${l.id}`,
      date: l.dateGiven,
      type: "LOAN_ISSUED",
      description: `Loan issued${l.reason ? ` — ${l.reason}` : ""}`,
      debit: Number(l.principalAmount),
      credit: 0,
      reference: l.id,
      payrollPeriodId: null,
      payrollPeriodName: null,
      clientId: null,
      clientName: null,
      siteId: null,
      siteName: null,
    });
  }

  for (const r of advanceRepayments) {
    entries.push({
      id: `advance-repay-${r.id}`,
      date: r.date,
      type: "ADVANCE_RECOVERY",
      description: `Advance recovery (advance issued ${r.advance.dateGiven.toISOString().slice(0, 10)})`,
      debit: 0,
      credit: Number(r.amount),
      reference: r.advanceId,
      payrollPeriodId: null,
      payrollPeriodName: null,
      clientId: null,
      clientName: null,
      siteId: null,
      siteName: null,
    });
  }

  for (const r of loanRepayments) {
    entries.push({
      id: `loan-repay-${r.id}`,
      date: r.date,
      type: "LOAN_RECOVERY",
      description: `Loan deduction (loan issued ${r.loan.dateGiven.toISOString().slice(0, 10)})`,
      debit: 0,
      credit: Number(r.amount),
      reference: r.loanId,
      payrollPeriodId: null,
      payrollPeriodName: null,
      clientId: null,
      clientName: null,
      siteId: null,
      siteName: null,
    });
  }

  for (const s of adjustments) {
    const amount = Math.abs(Number(s.amount));
    entries.push({
      id: `adjustment-${s.id}`,
      date: s.createdAt,
      type: s.type === "BONUS" ? "BONUS" : s.type === "DEDUCTION" ? "DEDUCTION" : "CORRECTION",
      description: `${s.type === "BONUS" ? "Bonus" : s.type === "DEDUCTION" ? "Deduction" : "Correction"}${s.reason ? ` — ${s.reason}` : ""}`,
      debit: s.type === "DEDUCTION" || Number(s.amount) < 0 ? amount : 0,
      credit: s.type === "DEDUCTION" || Number(s.amount) < 0 ? 0 : amount,
      reference: null,
      payrollPeriodId: s.payrollPeriodId,
      payrollPeriodName: s.payrollPeriod?.name ?? null,
      clientId: null,
      clientName: null,
      siteId: null,
      siteName: null,
    });
  }

  for (const d of chargeDeductions) {
    entries.push({
      id: `charge-${d.id}`,
      date: d.date,
      type: "RECURRING_CHARGE",
      description: `${d.charge.category.charAt(0) + d.charge.category.slice(1).toLowerCase()} charge${d.charge.description ? ` — ${d.charge.description}` : ""}`,
      debit: Number(d.amount),
      credit: 0,
      reference: d.chargeId,
      payrollPeriodId: null,
      payrollPeriodName: null,
      clientId: null,
      clientName: null,
      siteId: null,
      siteName: null,
    });
  }

  entries.sort((a, b) => a.date.getTime() - b.date.getTime());

  let running = 0;
  return entries.map((e) => {
    running += e.credit - e.debit;
    return { ...e, balance: running };
  });
}
