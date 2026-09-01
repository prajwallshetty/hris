"use server";

import { Decimal } from "decimal.js";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import {
  clientPaymentFormSchema,
  generateInvoiceFormSchema,
  issueInvoiceFormSchema,
  type ClientPaymentFormInput,
  type GenerateInvoiceFormInput,
  type IssueInvoiceFormInput,
} from "@/lib/validation/invoice";
import { actionError, ok, type ActionResult } from "@/server/action-result";
import { logAudit } from "@/server/audit";
import { calculateOutstanding } from "@/server/calc";
import { buildInvoiceDraft, type BillableHoursRow } from "@/server/invoicing/build-invoice-draft";
import { assertCan } from "@/server/rbac";
import { getActiveBillingRule } from "@/server/queries/settings";
import { findExistingInvoiceForExactPeriod, listApprovedHoursForClientPeriod } from "@/server/queries/invoices";
import { getSessionUser } from "@/server/session";

/**
 * Generates one Invoice with one line item per worker/site group, from
 * approved+locked timesheet hours x each assignment's clientBillingRate
 * (§20/§21 — independent of worker payroll, which uses workerHourlyRate).
 */
export async function generateInvoice(input: GenerateInvoiceFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "invoice");
    const data = generateInvoiceFormSchema.parse(input);

    const periodStart = new Date(data.billingPeriodStart);
    const periodEnd = new Date(data.billingPeriodEnd);

    const existing = await findExistingInvoiceForExactPeriod(data.clientId, periodStart, periodEnd);
    if (existing) {
      return { success: false, error: "An invoice already exists for this exact billing period." };
    }

    const items = await listApprovedHoursForClientPeriod(data.clientId, periodStart, periodEnd, data.projectId || undefined);
    if (items.length === 0) {
      return { success: false, error: "No approved (locked) hours found for this client and period." };
    }

    const billableRows: BillableHoursRow[] = items
      .filter((item) => item.assignment !== null)
      .map((item) => ({
        workerId: item.workerId,
        siteId: item.assignment!.siteId,
        description: `${item.worker.fullName} — ${item.assignment!.site.name}`,
        clientBillingRate: item.assignment!.clientBillingRate.toString(),
        hours: new Decimal(item.regularHours.toString()).plus(item.overtimeHours.toString()).toString(),
      }));

    if (billableRows.length === 0) {
      return { success: false, error: "None of the approved hours in this period have a billable assignment rate." };
    }

    const billingRule = await getActiveBillingRule();
    const draft = buildInvoiceDraft(billableRows, billingRule.taxPercent.toString());

    const invoice = await db.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          clientId: data.clientId,
          projectId: data.projectId || null,
          billingPeriodStart: periodStart,
          billingPeriodEnd: periodEnd,
          status: "DRAFT",
          subtotal: draft.subtotal,
          taxAmount: draft.taxAmount,
          totalAmount: draft.totalAmount,
          createdById: user.id,
        },
      });
      await tx.invoiceItem.createMany({
        data: draft.items.map((i) => ({ invoiceId: created.id, ...i })),
      });
      return created;
    });

    await logAudit({
      userId: user.id,
      action: "create",
      entityType: "Invoice",
      entityId: invoice.id,
      newValue: { clientId: data.clientId, periodStart, periodEnd, totalAmount: draft.totalAmount },
    });

    revalidatePath("/invoices");
    revalidatePath(`/clients/${data.clientId}`);
    return ok({ id: invoice.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function approveInvoice(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "invoice");
    const before = await db.invoice.findUniqueOrThrow({ where: { id } });
    if (before.status !== "DRAFT") {
      return { success: false, error: "Only draft invoices can be approved." };
    }
    const invoice = await db.invoice.update({ where: { id }, data: { status: "APPROVED", approvedById: user.id } });
    await logAudit({ userId: user.id, action: "update", entityType: "Invoice", entityId: id, previousValue: before, newValue: invoice });
    revalidatePath("/invoices");
    revalidatePath(`/invoices/${id}`);
    return ok({ id });
  } catch (error) {
    return actionError(error);
  }
}

export async function issueInvoice(input: IssueInvoiceFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "invoice");
    const data = issueInvoiceFormSchema.parse(input);
    const before = await db.invoice.findUniqueOrThrow({ where: { id: data.invoiceId } });
    if (before.status !== "APPROVED") {
      return { success: false, error: "Only approved invoices can be issued." };
    }
    const invoice = await db.invoice.update({
      where: { id: data.invoiceId },
      data: { status: "ISSUED", issuedAt: new Date(), dueDate: new Date(data.dueDate) },
    });
    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "Invoice",
      entityId: data.invoiceId,
      previousValue: before,
      newValue: invoice,
    });
    revalidatePath("/invoices");
    revalidatePath(`/invoices/${data.invoiceId}`);
    return ok({ id: data.invoiceId });
  } catch (error) {
    return actionError(error);
  }
}

export async function cancelInvoice(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "invoice");
    const before = await db.invoice.findUniqueOrThrow({ where: { id } });
    if (before.status === "PAID" || before.status === "PARTIALLY_PAID") {
      return { success: false, error: "An invoice with recorded payments cannot be cancelled." };
    }
    const invoice = await db.invoice.update({ where: { id }, data: { status: "CANCELLED" } });
    await logAudit({ userId: user.id, action: "update", entityType: "Invoice", entityId: id, previousValue: before, newValue: invoice });
    revalidatePath("/invoices");
    revalidatePath(`/invoices/${id}`);
    return ok({ id });
  } catch (error) {
    return actionError(error);
  }
}

// Every client payment lands in the ledger; Outstanding is always Invoice
// Total minus the payment ledger, never a manually typed amount (§23).
export async function createClientPayment(input: ClientPaymentFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "clientPayment");
    const data = clientPaymentFormSchema.parse(input);

    const payment = await db.$transaction(async (tx) => {
      const created = await tx.clientPayment.create({
        data: {
          clientId: data.clientId,
          invoiceId: data.invoiceId || null,
          amount: data.amount,
          method: data.method,
          referenceNumber: data.referenceNumber || null,
          date: new Date(data.date),
          remarks: data.remarks || null,
          createdById: user.id,
        },
      });

      if (data.invoiceId) {
        const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: data.invoiceId }, include: { payments: true } });
        const outstanding = calculateOutstanding(
          invoice.totalAmount.toString(),
          invoice.payments.map((p) => p.amount.toString()),
        );
        await tx.invoice.update({
          where: { id: data.invoiceId },
          data: { status: outstanding.lte(0) ? "PAID" : "PARTIALLY_PAID" },
        });
      }

      return created;
    });

    await logAudit({ userId: user.id, action: "create", entityType: "ClientPayment", entityId: payment.id, newValue: data });
    revalidatePath(`/clients/${data.clientId}`);
    revalidatePath("/invoices");
    if (data.invoiceId) revalidatePath(`/invoices/${data.invoiceId}`);
    return ok({ id: payment.id });
  } catch (error) {
    return actionError(error);
  }
}
