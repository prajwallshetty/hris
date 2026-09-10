"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";
import { formatEmployeeCode } from "@/lib/codes";
import { attendanceFormSchema, employeeFormSchema, type AttendanceFormInput, type EmployeeFormInput } from "@/lib/validation/employee";
import { actionError, ok, type ActionResult } from "@/server/action-result";
import { logAudit } from "@/server/audit";
import { assertCan } from "@/server/rbac";
import { listEmployees } from "@/server/queries/employees";
import { getSessionUser } from "@/server/session";

function toDate(value?: string) {
  return value ? new Date(value) : null;
}

async function resolveDesignationId(title?: string | null): Promise<string | null> {
  const trimmed = title?.trim();
  if (!trimmed) return null;
  const designation = await db.designation.upsert({ where: { title: trimmed }, update: {}, create: { title: trimmed } });
  return designation.id;
}

async function resolveDepartmentId(name?: string | null): Promise<string | null> {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  const department = await db.department.upsert({ where: { name: trimmed }, update: {}, create: { name: trimmed } });
  return department.id;
}

async function buildData(data: EmployeeFormInput) {
  const [departmentId, designationId] = await Promise.all([
    resolveDepartmentId(data.department),
    resolveDesignationId(data.designation),
  ]);
  return {
    fullName: data.fullName,
    email: data.email || null,
    phone: data.phone || null,
    departmentId,
    designationId,
    joiningDate: toDate(data.joiningDate),
    coordinatorId: data.coordinatorId || null,
    baseSalary: data.baseSalary,
    status: data.status,
    bankName: data.bankName || null,
    bankAccountIban: data.bankAccountIban || null,
    notes: data.notes || null,
  };
}

export async function createEmployee(input: EmployeeFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "create", "employee");
    const data = employeeFormSchema.parse(input);

    const employee = await db.internalEmployee.create({ data: await buildData(data) });

    await logAudit({ userId: user.id, action: "create", entityType: "InternalEmployee", entityId: employee.id, newValue: data });
    revalidatePath("/employees");
    return ok({ id: employee.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function updateEmployee(id: string, input: EmployeeFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "employee");
    const data = employeeFormSchema.parse(input);

    const before = await db.internalEmployee.findUniqueOrThrow({ where: { id } });
    const employee = await db.internalEmployee.update({ where: { id }, data: await buildData(data) });

    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "InternalEmployee",
      entityId: employee.id,
      previousValue: before,
      newValue: data,
    });

    revalidatePath("/employees");
    revalidatePath(`/employees/${id}`);
    return ok({ id: employee.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function archiveEmployee(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "archive", "employee");
    const employee = await db.internalEmployee.update({ where: { id }, data: { deletedAt: new Date() } });
    await logAudit({ userId: user.id, action: "archive", entityType: "InternalEmployee", entityId: employee.id });
    revalidatePath("/employees");
    revalidatePath(`/employees/${id}`);
    return ok({ id: employee.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function reactivateEmployee(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "archive", "employee");
    const employee = await db.internalEmployee.update({ where: { id }, data: { deletedAt: null } });
    await logAudit({ userId: user.id, action: "reactivate", entityType: "InternalEmployee", entityId: employee.id });
    revalidatePath("/employees");
    revalidatePath(`/employees/${id}`);
    return ok({ id: employee.id });
  } catch (error) {
    return actionError(error);
  }
}

// Ignores pagination so a filtered CSV export always reflects every
// matching row, not just the current page (§14 — filtered download must
// reflect exactly what's filtered).
export async function exportEmployeesCsv(search?: string): Promise<ActionResult<{ csv: string }>> {
  try {
    const user = await getSessionUser();
    const { employees } = await listEmployees(user, { search, page: 1, pageSize: 100000 });
    const csv = toCsv(
      ["Employee ID", "Name", "Department", "Designation", "Base Salary", "Status", "Archived"],
      employees.map((e) => [
        formatEmployeeCode(e.sequenceNo),
        e.fullName,
        e.department?.name ?? "",
        e.designation?.title ?? "",
        Number(e.baseSalary).toFixed(2),
        e.status,
        e.deletedAt ? "Yes" : "No",
      ]),
    );
    return ok({ csv });
  } catch (error) {
    return actionError(error);
  }
}

export async function recordAttendance(input: AttendanceFormInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getSessionUser();
    assertCan(user, "update", "attendance");
    const data = attendanceFormSchema.parse(input);
    const date = new Date(data.date);

    const combine = (time?: string) => (time ? new Date(`${data.date}T${time}:00`) : null);

    const attendance = await db.attendance.upsert({
      where: { employeeId_date: { employeeId: data.employeeId, date } },
      update: { status: data.status, checkIn: combine(data.checkIn), checkOut: combine(data.checkOut), remarks: data.remarks || null },
      create: {
        employeeId: data.employeeId,
        date,
        status: data.status,
        checkIn: combine(data.checkIn),
        checkOut: combine(data.checkOut),
        remarks: data.remarks || null,
      },
    });

    await logAudit({
      userId: user.id,
      action: "update",
      entityType: "Attendance",
      entityId: attendance.id,
      newValue: data,
    });

    revalidatePath(`/employees/${data.employeeId}`);
    return ok({ id: attendance.id });
  } catch (error) {
    return actionError(error);
  }
}
