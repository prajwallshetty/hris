"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import {
  clientContactFormSchema,
  clientContractFormSchema,
  clientFormSchema,
  projectFormSchema,
  siteFormSchema,
  type ClientContactFormInput,
  type ClientContractFormInput,
  type ClientFormInput,
  type ProjectFormInput,
  type SiteFormInput,
} from "@/lib/validation/client";
import { actionError, ok, type ActionResult } from "@/server/action-result";
import { logAudit } from "@/server/audit";
import { assertCan } from "@/server/rbac";
import { getSessionUser } from "@/server/session";

export async function createClient(input: ClientFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "client");
    const data = clientFormSchema.parse(input);

    const client = await db.client.create({
      data: {
        companyName: data.companyName,
        contactPerson: data.contactPerson || null,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        contractRef: data.contractRef || null,
        paymentTerms: data.paymentTerms || null,
        billingTerms: data.billingTerms || null,
        status: data.status,
      },
    });

    await logAudit({ userId: user.id, action: "create", entityType: "Client", entityId: client.id, newValue: data });
    revalidatePath("/clients");
    return ok({ id: client.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function updateClient(
  id: string,
  input: ClientFormInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "client");
    const data = clientFormSchema.parse(input);

    const before = await db.client.findUniqueOrThrow({ where: { id } });
    const client = await db.client.update({
      where: { id },
      data: {
        companyName: data.companyName,
        contactPerson: data.contactPerson || null,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        contractRef: data.contractRef || null,
        paymentTerms: data.paymentTerms || null,
        billingTerms: data.billingTerms || null,
        status: data.status,
      },
    });

    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "Client",
      entityId: client.id,
      previousValue: before,
      newValue: data,
    });
    revalidatePath("/clients");
    revalidatePath(`/clients/${id}`);
    return ok({ id: client.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function archiveClient(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "archive", "client");
    const client = await db.client.update({ where: { id }, data: { deletedAt: new Date() } });
    await logAudit({ userId: user.id, action: "archive", entityType: "Client", entityId: client.id });
    revalidatePath("/clients");
    return ok({ id: client.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function createProject(input: ProjectFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "project");
    const data = projectFormSchema.parse(input);

    const project = await db.project.create({
      data: { clientId: data.clientId, name: data.name, status: data.status },
    });

    await logAudit({ userId: user.id, action: "create", entityType: "Project", entityId: project.id, newValue: data });
    revalidatePath(`/clients/${data.clientId}`);
    return ok({ id: project.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function createSite(input: SiteFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "site");
    const data = siteFormSchema.parse(input);

    const site = await db.site.create({
      data: { projectId: data.projectId, name: data.name, location: data.location || null, status: data.status },
    });

    const project = await db.project.findUniqueOrThrow({ where: { id: data.projectId } });

    await logAudit({ userId: user.id, action: "create", entityType: "Site", entityId: site.id, newValue: data });
    revalidatePath(`/clients/${project.clientId}`);
    return ok({ id: site.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function createClientContact(input: ClientContactFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "client");
    const data = clientContactFormSchema.parse(input);

    const contact = await db.clientContact.create({
      data: {
        clientId: data.clientId,
        name: data.name,
        designation: data.designation || null,
        phone: data.phone || null,
        email: data.email || null,
        isPrimary: data.isPrimary,
      },
    });

    await logAudit({ userId: user.id, action: "create", entityType: "ClientContact", entityId: contact.id, newValue: data });
    revalidatePath(`/clients/${data.clientId}`);
    return ok({ id: contact.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function createClientContract(input: ClientContractFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "client");
    const data = clientContractFormSchema.parse(input);

    const contract = await db.clientContract.create({
      data: {
        clientId: data.clientId,
        contractNumber: data.contractNumber || null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        terms: data.terms || null,
      },
    });

    await logAudit({ userId: user.id, action: "create", entityType: "ClientContract", entityId: contract.id, newValue: data });
    revalidatePath(`/clients/${data.clientId}`);
    return ok({ id: contract.id });
  } catch (error) {
    return actionError(error);
  }
}
