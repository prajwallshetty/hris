import type { Prisma, Role } from "@prisma/client";

export type SessionUser = {
  id: string;
  role: Role;
  coordinatorId: string | null;
  clientId: string | null;
};

export type Resource =
  | "worker"
  | "client"
  | "project"
  | "site"
  | "assignment"
  | "coordinator"
  | "user"
  | "auditLog"
  | "designation"
  | "department"
  | "employee"
  | "attendance"
  | "leaveType"
  | "leaveRequest"
  | "timesheet"
  | "payrollPeriod"
  | "workerPayroll"
  | "employeePayroll"
  | "salaryAdjustment"
  | "workerPayment"
  | "clientPayment"
  | "advance"
  | "loan"
  | "expense"
  | "invoice"
  | "sale"
  | "commission"
  | "settings";

export type Action = "view" | "create" | "update" | "archive";

const FULL: Action[] = ["view", "create", "update", "archive"];
const VIEW: Action[] = ["view"];

// Single source of truth for who may do what. Every server action / query
// must call `can()`/`assertCan()` before mutating or returning data — never
// rely on the UI hiding a button (§21/§24). Kept as a reviewable, type-checked
// code matrix rather than dynamic DB-driven roles/permissions tables — see
// the note on the User model in schema.prisma for why.
const PERMISSIONS: Record<Role, Partial<Record<Resource, Action[]>>> = {
  SUPER_ADMIN: {
    worker: FULL,
    client: FULL,
    project: FULL,
    site: FULL,
    assignment: FULL,
    coordinator: FULL,
    user: FULL,
    auditLog: VIEW,
    designation: FULL,
    department: FULL,
    employee: FULL,
    attendance: FULL,
    leaveType: FULL,
    leaveRequest: FULL,
    timesheet: FULL,
    payrollPeriod: FULL,
    workerPayroll: FULL,
    employeePayroll: FULL,
    salaryAdjustment: FULL,
    workerPayment: FULL,
    clientPayment: FULL,
    advance: FULL,
    loan: FULL,
    expense: FULL,
    invoice: FULL,
    sale: FULL,
    commission: FULL,
    settings: FULL,
  },
  // Operational administration: everything SUPER_ADMIN has except user
  // account management, which stays reserved for SUPER_ADMIN.
  ADMIN: {
    worker: FULL,
    client: FULL,
    project: FULL,
    site: FULL,
    assignment: FULL,
    coordinator: FULL,
    auditLog: VIEW,
    designation: FULL,
    department: FULL,
    employee: FULL,
    attendance: FULL,
    leaveType: FULL,
    leaveRequest: FULL,
    timesheet: FULL,
    payrollPeriod: FULL,
    workerPayroll: FULL,
    employeePayroll: FULL,
    salaryAdjustment: FULL,
    workerPayment: FULL,
    clientPayment: FULL,
    advance: FULL,
    loan: FULL,
    expense: FULL,
    invoice: FULL,
    sale: FULL,
    commission: FULL,
    settings: FULL,
  },
  // Workers, internal employees, leave, attendance (§21).
  HR: {
    worker: FULL,
    client: FULL,
    project: FULL,
    site: FULL,
    assignment: FULL,
    coordinator: FULL,
    auditLog: VIEW,
    designation: FULL,
    department: FULL,
    employee: FULL,
    attendance: FULL,
    leaveType: FULL,
    leaveRequest: FULL,
    timesheet: VIEW,
    payrollPeriod: VIEW,
    workerPayroll: VIEW,
    employeePayroll: VIEW,
  },
  // Payroll, payments, invoices, expenses (§21).
  ACCOUNTS: {
    worker: VIEW,
    client: VIEW,
    project: VIEW,
    site: VIEW,
    assignment: VIEW,
    coordinator: VIEW,
    employee: VIEW,
    timesheet: FULL,
    payrollPeriod: FULL,
    workerPayroll: FULL,
    employeePayroll: FULL,
    salaryAdjustment: FULL,
    workerPayment: FULL,
    clientPayment: FULL,
    advance: FULL,
    loan: FULL,
    expense: FULL,
    invoice: FULL,
    commission: VIEW,
    settings: FULL,
  },
  // Reports and approvals — broad view, no master-data editing (§21).
  MANAGER: {
    worker: VIEW,
    client: VIEW,
    project: VIEW,
    site: VIEW,
    assignment: VIEW,
    coordinator: VIEW,
    auditLog: VIEW,
    employee: VIEW,
    attendance: VIEW,
    leaveRequest: ["view", "update"], // approve/reject
    timesheet: ["view", "update"], // approve/reject
    payrollPeriod: ["view", "update"], // approve
    workerPayroll: VIEW,
    employeePayroll: VIEW,
    invoice: ["view", "update"], // approve
    expense: VIEW,
    sale: VIEW,
    commission: ["view", "update"], // approve
  },
  // Scoped to their own workers/clients — see scope helpers below.
  COORDINATOR: {
    worker: VIEW,
    client: VIEW,
    project: VIEW,
    site: VIEW,
    assignment: VIEW,
    sale: ["view", "create"],
    commission: VIEW,
  },
  // Scoped to their own client record — see scope helpers below.
  CLIENT: {
    worker: VIEW,
    project: VIEW,
    site: VIEW,
    assignment: VIEW,
    invoice: VIEW,
    clientPayment: VIEW,
  },
  // No cross-worker/cross-employee access yet — self-service (own profile,
  // own payslips) lands with the Internal Employee HR phase, once a User
  // can be linked to its own InternalEmployee record.
  EMPLOYEE: {},
};

export function can(user: SessionUser, action: Action, resource: Resource): boolean {
  const allowed = PERMISSIONS[user.role]?.[resource];
  return allowed?.includes(action) ?? false;
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function assertCan(user: SessionUser, action: Action, resource: Resource) {
  if (!can(user, action, resource)) {
    throw new ForbiddenError();
  }
}

// Row-level scoping for roles that only see a slice of the data.
// Returns `undefined` for roles with unrestricted view (spread into a
// Prisma `where`), or a Prisma filter object for COORDINATOR/CLIENT.
export function workerScopeWhere(user: SessionUser): Prisma.WorkerWhereInput | undefined {
  if (user.role === "COORDINATOR") {
    return { coordinatorId: user.coordinatorId ?? "__none__" };
  }
  if (user.role === "CLIENT") {
    return {
      assignments: { some: { clientId: user.clientId ?? "__none__", status: "ACTIVE" } },
    };
  }
  return undefined;
}

export function clientScopeWhere(user: SessionUser): Prisma.ClientWhereInput | undefined {
  if (user.role === "COORDINATOR") {
    return { assignments: { some: { coordinatorId: user.coordinatorId ?? "__none__" } } };
  }
  if (user.role === "CLIENT") {
    return { id: user.clientId ?? "__none__" };
  }
  return undefined;
}

export function assignmentScopeWhere(user: SessionUser): Prisma.AssignmentWhereInput | undefined {
  if (user.role === "COORDINATOR") {
    return { coordinatorId: user.coordinatorId ?? "__none__" };
  }
  if (user.role === "CLIENT") {
    return { clientId: user.clientId ?? "__none__" };
  }
  return undefined;
}
