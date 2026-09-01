import { db } from "@/lib/db";
import { calculateOutstanding } from "@/server/calc";
import { can, clientScopeWhere, workerScopeWhere, type SessionUser } from "@/server/rbac";

export type NotificationItem = {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  href: string;
  date: Date;
};

const EXPIRY_WINDOW_DAYS = 30;

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

/**
 * §36 notifications — computed live from current data rather than a
 * persisted, job-populated table: this deployment has no background
 * scheduler, so a stored "generated" notification would either need one
 * or risk going stale. Every item here deep-links to the record it's about.
 */
export async function getNotifications(user: SessionUser): Promise<NotificationItem[]> {
  const items: NotificationItem[] = [];
  const soon = daysFromNow(EXPIRY_WINDOW_DAYS);

  if (can(user, "view", "worker")) {
    const [expiringIqama, expiringPassport] = await Promise.all([
      db.worker.findMany({
        where: { deletedAt: null, ...workerScopeWhere(user), iqamaExpiryDate: { lte: soon } },
        select: { id: true, fullName: true, iqamaExpiryDate: true },
        take: 20,
      }),
      db.worker.findMany({
        where: { deletedAt: null, ...workerScopeWhere(user), passportExpiryDate: { lte: soon } },
        select: { id: true, fullName: true, passportExpiryDate: true },
        take: 20,
      }),
    ]);
    for (const w of expiringIqama) {
      const expired = w.iqamaExpiryDate! < new Date();
      items.push({
        id: `iqama-${w.id}`,
        severity: expired ? "critical" : "warning",
        title: expired ? "Iqama expired" : "Iqama expiring soon",
        message: `${w.fullName}'s Iqama ${expired ? "expired" : "expires"} on ${w.iqamaExpiryDate!.toLocaleDateString("en-GB")}.`,
        href: `/workers/${w.id}`,
        date: w.iqamaExpiryDate!,
      });
    }
    for (const w of expiringPassport) {
      const expired = w.passportExpiryDate! < new Date();
      items.push({
        id: `passport-${w.id}`,
        severity: expired ? "critical" : "warning",
        title: expired ? "Passport expired" : "Passport expiring soon",
        message: `${w.fullName}'s passport ${expired ? "expired" : "expires"} on ${w.passportExpiryDate!.toLocaleDateString("en-GB")}.`,
        href: `/workers/${w.id}`,
        date: w.passportExpiryDate!,
      });
    }
  }

  if (can(user, "view", "client")) {
    const expiringContracts = await db.clientContract.findMany({
      where: { status: "ACTIVE", endDate: { lte: soon }, client: { deletedAt: null, ...clientScopeWhere(user) } },
      select: { id: true, contractNumber: true, endDate: true, clientId: true, client: { select: { companyName: true } } },
      take: 20,
    });
    for (const c of expiringContracts) {
      items.push({
        id: `contract-${c.id}`,
        severity: c.endDate! < new Date() ? "critical" : "warning",
        title: "Contract expiring",
        message: `${c.client.companyName}'s contract ${c.contractNumber ?? ""} ends on ${c.endDate!.toLocaleDateString("en-GB")}.`,
        href: `/clients/${c.clientId}`,
        date: c.endDate!,
      });
    }
  }

  if (can(user, "update", "timesheet")) {
    const pendingTimesheets = await db.timesheet.findMany({
      where: { status: "PENDING_REVIEW" },
      select: { id: true, period: true, site: { select: { name: true } } },
      take: 20,
    });
    for (const t of pendingTimesheets) {
      items.push({
        id: `timesheet-${t.id}`,
        severity: "info",
        title: "Timesheet pending review",
        message: `${t.site?.name ?? "A timesheet"} for ${t.period.toLocaleDateString("en-GB", { month: "long", year: "numeric" })} needs review.`,
        href: `/timesheets/${t.id}`,
        date: t.period,
      });
    }
  }

  if (can(user, "update", "workerPayroll")) {
    const reviewPayrolls = await db.workerPayroll.findMany({
      where: { status: "REVIEW" },
      select: { id: true, worker: { select: { fullName: true } }, payrollPeriod: { select: { name: true } } },
      take: 20,
    });
    for (const p of reviewPayrolls) {
      items.push({
        id: `payroll-${p.id}`,
        severity: "info",
        title: "Payroll pending approval",
        message: `${p.worker.fullName}'s payroll for ${p.payrollPeriod.name} is awaiting approval.`,
        href: `/payroll/worker/${p.id}`,
        date: new Date(),
      });
    }

    const approvedUnpaid = await db.workerPayroll.findMany({
      where: { status: { in: ["APPROVED", "PARTIALLY_PAID"] } },
      include: { payments: true, worker: { select: { fullName: true } }, payrollPeriod: { select: { name: true } } },
      take: 30,
    });
    for (const p of approvedUnpaid) {
      const outstanding = calculateOutstanding(
        p.netPayable.toString(),
        p.payments.map((pay) => pay.amount.toString()),
      );
      if (outstanding.gt(0)) {
        items.push({
          id: `salary-due-${p.id}`,
          severity: "warning",
          title: "Salary due",
          message: `${p.worker.fullName} has SAR ${outstanding.toFixed(2)} outstanding for ${p.payrollPeriod.name}.`,
          href: `/payroll/worker/${p.id}`,
          date: new Date(),
        });
      }
    }
  }

  if (can(user, "view", "invoice")) {
    const overdueInvoices = await db.invoice.findMany({
      where: { status: { in: ["ISSUED", "PARTIALLY_PAID"] }, dueDate: { lt: new Date() } },
      select: { id: true, sequenceNo: true, dueDate: true, client: { select: { companyName: true } } },
      take: 20,
    });
    for (const inv of overdueInvoices) {
      items.push({
        id: `invoice-overdue-${inv.id}`,
        severity: "critical",
        title: "Client payment overdue",
        message: `Invoice #${inv.sequenceNo} for ${inv.client.companyName} was due ${inv.dueDate!.toLocaleDateString("en-GB")}.`,
        href: `/invoices/${inv.id}`,
        date: inv.dueDate!,
      });
    }
  }

  if (can(user, "update", "commission")) {
    const payableCommissions = await db.commission.findMany({
      where: { status: "PAYABLE" },
      select: { id: true, amount: true, coordinator: { select: { name: true } } },
      take: 20,
    });
    for (const c of payableCommissions) {
      items.push({
        id: `commission-${c.id}`,
        severity: "info",
        title: "Commission payable",
        message: `${c.coordinator.name} has a SAR ${Number(c.amount).toFixed(2)} commission ready to pay.`,
        href: `/coordinators`,
        date: new Date(),
      });
    }
  }

  if (can(user, "update", "leaveRequest")) {
    const pendingLeave = await db.leaveRequest.findMany({
      where: { status: "PENDING" },
      select: {
        id: true,
        startDate: true,
        worker: { select: { id: true, fullName: true } },
        employee: { select: { id: true, fullName: true } },
      },
      take: 20,
    });
    for (const r of pendingLeave) {
      const name = r.worker?.fullName ?? r.employee?.fullName ?? "Someone";
      const href = r.worker ? `/workers/${r.worker.id}` : `/employees/${r.employee?.id}`;
      items.push({
        id: `leave-${r.id}`,
        severity: "info",
        title: "Leave approval pending",
        message: `${name} requested leave starting ${r.startDate.toLocaleDateString("en-GB")}.`,
        href,
        date: r.startDate,
      });
    }
  }

  if (user.role === "COORDINATOR") {
    // Coordinators only ever see their own payable commissions, matching commissionScopeWhere elsewhere.
    const own = await db.commission.findMany({
      where: { status: "PAYABLE", coordinatorId: user.coordinatorId ?? "__none__" },
      select: { id: true, amount: true },
      take: 20,
    });
    for (const c of own) {
      items.push({
        id: `own-commission-${c.id}`,
        severity: "info",
        title: "Commission payable",
        message: `You have a SAR ${Number(c.amount).toFixed(2)} commission ready to pay.`,
        href: `/coordinators/${user.coordinatorId}`,
        date: new Date(),
      });
    }
  }

  return items.sort((a, b) => a.date.getTime() - b.date.getTime());
}
