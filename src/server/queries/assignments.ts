import type { AssignmentStatus, Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { assertCan, assignmentScopeWhere, type SessionUser } from "@/server/rbac";

export type AssignmentSortField =
  | "worker"
  | "iqama"
  | "client"
  | "project"
  | "site"
  | "coordinator"
  | "workerHourlyRate"
  | "clientBillingRate"
  | "startDate"
  | "endDate"
  | "status";

export type AssignmentQueryParams = {
  search?: string;
  workerId?: string;
  clientId?: string;
  projectId?: string;
  siteId?: string;
  coordinatorId?: string;
  status?: AssignmentStatus | "SCHEDULED" | "ENDING_SOON" | "ALL";
  startDateFrom?: string;
  startDateTo?: string;
  sortBy?: AssignmentSortField;
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export async function getAssignmentStats(user: SessionUser) {
  assertCan(user, "view", "assignment");
  const baseWhere: Prisma.AssignmentWhereInput = assignmentScopeWhere(user) ?? {};

  const now = new Date();

  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [total, active, scheduled, endingSoon, ended] = await Promise.all([
    db.assignment.count({ where: baseWhere }),
    db.assignment.count({
      where: {
        ...baseWhere,
        status: "ACTIVE",
        startDate: { lte: now },
      },
    }),
    db.assignment.count({
      where: {
        ...baseWhere,
        status: "ACTIVE",
        startDate: { gt: now },
      },
    }),
    db.assignment.count({
      where: {
        ...baseWhere,
        status: "ACTIVE",
        endDate: {
          gte: now,
          lte: thirtyDaysFromNow,
        },
      },
    }),
    db.assignment.count({
      where: {
        ...baseWhere,
        status: "ENDED",
      },
    }),
  ]);

  return { total, active, scheduled, endingSoon, ended };
}

function buildWhereClause(
  user: SessionUser,
  params: AssignmentQueryParams,
): Prisma.AssignmentWhereInput {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const searchWhere: Prisma.AssignmentWhereInput = params.search
    ? {
        OR: [
          { worker: { fullName: { contains: params.search, mode: "insensitive" } } },
          { worker: { iqamaNumber: { contains: params.search, mode: "insensitive" } } },
          { client: { companyName: { contains: params.search, mode: "insensitive" } } },
          { project: { name: { contains: params.search, mode: "insensitive" } } },
          { site: { name: { contains: params.search, mode: "insensitive" } } },
          { coordinator: { name: { contains: params.search, mode: "insensitive" } } },
        ],
      }
    : {};

  let statusWhere: Prisma.AssignmentWhereInput = {};
  if (params.status && params.status !== "ALL") {
    if (params.status === "ACTIVE") {
      statusWhere = { status: "ACTIVE", startDate: { lte: now } };
    } else if (params.status === "SCHEDULED") {
      statusWhere = { status: "ACTIVE", startDate: { gt: now } };
    } else if (params.status === "ENDING_SOON") {
      statusWhere = {
        status: "ACTIVE",
        endDate: { gte: now, lte: thirtyDaysFromNow },
      };
    } else if (params.status === "ENDED") {
      statusWhere = { status: "ENDED" };
    }
  }

  let dateWhere: Prisma.AssignmentWhereInput = {};
  if (params.startDateFrom || params.startDateTo) {
    dateWhere = {
      startDate: {
        ...(params.startDateFrom ? { gte: new Date(params.startDateFrom) } : {}),
        ...(params.startDateTo ? { lte: new Date(params.startDateTo) } : {}),
      },
    };
  }

  return {
    ...(assignmentScopeWhere(user) ?? {}),
    ...searchWhere,
    ...statusWhere,
    ...dateWhere,
    ...(params.workerId ? { workerId: params.workerId } : {}),
    ...(params.clientId ? { clientId: params.clientId } : {}),
    ...(params.projectId ? { projectId: params.projectId } : {}),
    ...(params.siteId ? { siteId: params.siteId } : {}),
    ...(params.coordinatorId ? { coordinatorId: params.coordinatorId } : {}),
  };
}

function buildOrderBy(
  sortBy?: AssignmentSortField,
  sortOrder: "asc" | "desc" = "desc",
): Prisma.AssignmentOrderByWithRelationInput {
  switch (sortBy) {
    case "worker":
      return { worker: { fullName: sortOrder } };
    case "iqama":
      return { worker: { iqamaNumber: sortOrder } };
    case "client":
      return { client: { companyName: sortOrder } };
    case "project":
      return { project: { name: sortOrder } };
    case "site":
      return { site: { name: sortOrder } };
    case "coordinator":
      return { coordinator: { name: sortOrder } };
    case "workerHourlyRate":
      return { workerHourlyRate: sortOrder };
    case "clientBillingRate":
      return { clientBillingRate: sortOrder };
    case "startDate":
      return { startDate: sortOrder };
    case "endDate":
      return { endDate: sortOrder };
    case "status":
      return { status: sortOrder };
    default:
      return { startDate: "desc" };
  }
}

export async function listAssignments(
  user: SessionUser,
  params: AssignmentQueryParams = {},
) {
  assertCan(user, "view", "assignment");
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;

  const where = buildWhereClause(user, params);
  const orderBy = buildOrderBy(params.sortBy, params.sortOrder);

  const [assignments, total] = await Promise.all([
    db.assignment.findMany({
      where,
      include: {
        worker: {
          select: {
            id: true,
            fullName: true,
            iqamaNumber: true,
            sequenceNo: true,
            status: true,
            designation: { select: { title: true } },
          },
        },
        client: { select: { id: true, companyName: true } },
        project: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
        coordinator: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.assignment.count({ where }),
  ]);

  return { assignments, total, page, pageSize };
}

export async function listAssignmentsForExport(
  user: SessionUser,
  params: AssignmentQueryParams = {},
) {
  assertCan(user, "view", "assignment");
  const where = buildWhereClause(user, params);
  const orderBy = buildOrderBy(params.sortBy, params.sortOrder);

  return db.assignment.findMany({
    where,
    include: {
      worker: {
        select: {
          fullName: true,
          iqamaNumber: true,
          sequenceNo: true,
          designation: { select: { title: true } },
        },
      },
      client: { select: { companyName: true } },
      project: { select: { name: true } },
      site: { select: { name: true } },
      coordinator: { select: { name: true } },
    },
    orderBy,
  });
}

export async function getAssignmentDetail(id: string, user: SessionUser) {
  assertCan(user, "view", "assignment");

  const assignment = await db.assignment.findFirst({
    where: {
      id,
      ...(assignmentScopeWhere(user) ?? {}),
    },

    include: {
      worker: {
        include: {
          designation: true,
        },
      },
      client: true,
      project: true,
      site: true,
      coordinator: true,
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!assignment) return null;

  // Fetch full assignment history for this worker
  const workerAssignments = await db.assignment.findMany({
    where: { workerId: assignment.workerId },
    include: {
      client: { select: { companyName: true } },
      project: { select: { name: true } },
      site: { select: { name: true } },
      coordinator: { select: { name: true } },
    },
    orderBy: { startDate: "desc" },
  });

  // Fetch related timesheets for this worker during assignment timeframe
  const timesheetItems = await db.timesheetItem.findMany({
    where: {
      workerId: assignment.workerId,
      date: {
        gte: assignment.startDate,
        ...(assignment.endDate ? { lte: assignment.endDate } : {}),
      },
    },
    include: {
      timesheet: {
        include: {
          site: { select: { name: true } },
        },
      },
    },
    orderBy: { date: "desc" },
    take: 20,
  });

  // Fetch related worker payroll rows for this worker
  const payrollRows = await db.workerPayroll.findMany({
    where: {
      workerId: assignment.workerId,
    },
    include: {
      payrollPeriod: true,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  // Fetch audit logs associated with this assignment
  const auditLogs = await db.auditLog.findMany({
    where: {
      entityType: "Assignment",
      entityId: assignment.id,
    },
    include: {
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return {
    assignment,
    workerAssignments,
    timesheetItems,
    payrollRows,
    auditLogs,
  };
}

export async function getActiveAssignmentForWorker(workerId: string) {
  return db.assignment.findFirst({
    where: { workerId, status: "ACTIVE" },
    include: { client: true, project: true, site: true },
  });
}

