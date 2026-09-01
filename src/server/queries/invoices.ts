import type { InvoiceStatus, Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { assertCan, invoiceScopeWhere, type SessionUser } from "@/server/rbac";

export async function listInvoices(
  user: SessionUser,
  params: { status?: InvoiceStatus | "ALL"; clientId?: string; page?: number; pageSize?: number } = {},
) {
  assertCan(user, "view", "invoice");
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;

  const where: Prisma.InvoiceWhereInput = {
    ...invoiceScopeWhere(user),
    ...(params.clientId ? { clientId: params.clientId } : {}),
    ...(params.status && params.status !== "ALL" ? { status: params.status } : {}),
  };

  const [invoices, total] = await Promise.all([
    db.invoice.findMany({
      where,
      include: { client: true, project: true, payments: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.invoice.count({ where }),
  ]);

  return { invoices, total, page, pageSize };
}

export async function getInvoiceDetail(user: SessionUser, id: string) {
  assertCan(user, "view", "invoice");
  return db.invoice.findFirst({
    where: { id, ...invoiceScopeWhere(user) },
    include: {
      client: true,
      project: true,
      items: { include: { worker: true, site: true }, orderBy: { createdAt: "asc" } },
      payments: { orderBy: { date: "desc" } },
    },
  });
}

/**
 * Approved hours for a client (optionally one project) in a billing period,
 * scoped to LOCKED timesheets only — the same "only approved/locked feeds
 * downstream" rule as payroll (§13), applied to billing instead of pay.
 */
export async function listApprovedHoursForClientPeriod(
  clientId: string,
  periodStart: Date,
  periodEnd: Date,
  projectId?: string,
) {
  return db.timesheetItem.findMany({
    where: {
      status: "APPROVED",
      date: { gte: periodStart, lte: periodEnd },
      timesheet: { status: "LOCKED", clientId, ...(projectId ? { projectId } : {}) },
    },
    include: {
      worker: { select: { id: true, fullName: true } },
      assignment: { select: { id: true, clientBillingRate: true, siteId: true, site: { select: { name: true } } } },
    },
  });
}

/**
 * Guards against accidentally re-generating the exact same billing period
 * twice. Doesn't catch overlapping-but-different date ranges — there's no
 * per-hour invoiced/not-invoiced marker in the schema yet — but stops the
 * common case of a double click or a repeated "this month" generation.
 */
export async function findExistingInvoiceForExactPeriod(clientId: string, periodStart: Date, periodEnd: Date) {
  return db.invoice.findFirst({
    where: {
      clientId,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      status: { not: "CANCELLED" },
    },
  });
}
