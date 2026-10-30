import type { Prisma, TimesheetItemStatus, TimesheetStatus, WorkerAttendanceStatus } from "@prisma/client";

import type { LeaveCategory } from "@/lib/attendance";

import { db } from "@/lib/db";
import { assertCan, type SessionUser } from "@/server/rbac";

export async function listTimesheets(
  user: SessionUser,
  params: { status?: TimesheetStatus | "ALL"; siteId?: string; page?: number; pageSize?: number } = {},
) {
  assertCan(user, "view", "timesheet");
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;

  const where: Prisma.TimesheetWhereInput = {
    ...(params.siteId ? { siteId: params.siteId } : {}),
    ...(params.status && params.status !== "ALL" ? { status: params.status } : {}),
  };

  const [timesheets, total] = await Promise.all([
    db.timesheet.findMany({
      where,
      include: {
        site: { include: { project: { include: { client: true } } } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.timesheet.count({ where }),
  ]);

  return { timesheets, total, page, pageSize };
}

export async function getTimesheetDetail(user: SessionUser, id: string) {
  assertCan(user, "view", "timesheet");
  return db.timesheet.findUnique({
    where: { id },
    include: {
      site: { include: { project: { include: { client: true } } } },
      items: {
        include: { worker: true, otherLeaveType: { select: { name: true } } },
        orderBy: [{ date: "asc" }, { worker: { fullName: "asc" } }],
      },
    },
  });
}

/** Every worker matching one of these Iqamas, keyed by Iqama (§7: the primary matching key). */
export async function findWorkersByIqamas(iqamas: string[]) {
  const map = new Map<string, { id: string; fullName: string }>();
  if (iqamas.length === 0) return map;
  const workers = await db.worker.findMany({
    where: { iqamaNumber: { in: iqamas }, deletedAt: null },
    select: { id: true, fullName: true, iqamaNumber: true },
  });
  workers.forEach((w) => {
    if (w.iqamaNumber) map.set(w.iqamaNumber, { id: w.id, fullName: w.fullName });
  });
  return map;
}

/** Iqamas of workers with an ACTIVE assignment at this site, for the "worker not assigned" check. */
export async function getAssignedIqamasForSite(siteId: string): Promise<Set<string>> {
  const assignments = await db.assignment.findMany({
    where: { siteId, status: "ACTIVE" },
    select: { worker: { select: { iqamaNumber: true } } },
  });
  return new Set(assignments.flatMap((a) => (a.worker.iqamaNumber ? [a.worker.iqamaNumber] : [])));
}

/** `${workerId}:${yyyy-mm-dd}` keys already recorded, for the duplicate-attendance check. */
export async function getExistingTimesheetKeys(workerIds: string[]): Promise<Set<string>> {
  if (workerIds.length === 0) return new Set();
  const items = await db.timesheetItem.findMany({
    where: { workerId: { in: workerIds } },
    select: { workerId: true, date: true },
  });
  return new Set(items.map((i) => `${i.workerId}:${i.date.toISOString().slice(0, 10)}`));
}

export async function getActiveAssignmentForWorkerAtSite(workerId: string, siteId: string) {
  return db.assignment.findFirst({ where: { workerId, siteId, status: "ACTIVE" } });
}

export type TimesheetLogFilters = {
  month?: string; // "YYYY-MM"
  search?: string; // worker name or Iqama
  clientId?: string;
  projectId?: string;
  siteId?: string;
  coordinatorId?: string;
  status?: TimesheetItemStatus | "ALL";
  attendanceStatus?: WorkerAttendanceStatus | "ALL";
  leave?: LeaveCategory | "ALL";
  page?: number;
  pageSize?: number;
};

const LEAVE_HOURS_FIELD: Record<LeaveCategory, "sickLeaveHours" | "annualLeaveHours" | "unpaidLeaveHours" | "otherLeaveHours"> = {
  SICK: "sickLeaveHours",
  ANNUAL: "annualLeaveHours",
  UNPAID: "unpaidLeaveHours",
  OTHER: "otherLeaveHours",
};

function buildTimesheetLogWhere(filters: TimesheetLogFilters): Prisma.TimesheetItemWhereInput {
  let dateRange: Prisma.DateTimeFilter | undefined;
  if (filters.month) {
    const [year, month] = filters.month.split("-").map(Number);
    if (year && month) dateRange = { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) };
  }
  const timesheetWhere: Prisma.TimesheetWhereInput = {
    ...(filters.clientId ? { clientId: filters.clientId } : {}),
    ...(filters.projectId ? { projectId: filters.projectId } : {}),
    ...(filters.siteId ? { siteId: filters.siteId } : {}),
  };
  const leaveField = filters.leave && filters.leave !== "ALL" ? LEAVE_HOURS_FIELD[filters.leave] : null;

  return {
    ...(dateRange ? { date: dateRange } : {}),
    ...(filters.status && filters.status !== "ALL" ? { status: filters.status } : {}),
    ...(filters.attendanceStatus && filters.attendanceStatus !== "ALL" ? { attendanceStatus: filters.attendanceStatus } : {}),
    ...(leaveField ? { [leaveField]: { gt: 0 } } : {}),
    ...(filters.search
      ? {
          OR: [
            { iqamaNumber: { contains: filters.search, mode: "insensitive" } },
            { worker: { fullName: { contains: filters.search, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(Object.keys(timesheetWhere).length > 0 ? { timesheet: timesheetWhere } : {}),
    ...(filters.coordinatorId ? { assignment: { coordinatorId: filters.coordinatorId } } : {}),
  };
}

// The flat, cross-batch "LOG" view (§ Timesheets (LOG)) — every individual
// worker-day entry across all timesheet batches, filterable and exportable
// independent of the batch/approval workflow on the main Timesheets list.
// Read-only: approve/lock stay batch-level actions on a Timesheet, not here.
export async function listTimesheetLog(user: SessionUser, filters: TimesheetLogFilters = {}) {
  assertCan(user, "view", "timesheet");
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 50;
  const where = buildTimesheetLogWhere(filters);

  const [items, total] = await Promise.all([
    db.timesheetItem.findMany({
      where,
      include: {
        worker: { select: { id: true, fullName: true, sequenceNo: true } },
        otherLeaveType: { select: { name: true } },
        timesheet: { include: { site: { include: { project: { include: { client: true } } } } } },
        assignment: { include: { coordinator: { select: { id: true, name: true } } } },
      },
      orderBy: [{ date: "desc" }, { worker: { fullName: "asc" } }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.timesheetItem.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export type TimesheetLogFilterOptions = {
  clients: { id: string; companyName: string }[];
  projects: { id: string; name: string; clientId: string }[];
  sites: { id: string; name: string; clientId: string; projectId: string }[];
  coordinators: { id: string; name: string }[];
};

export async function getTimesheetLogFilterOptions(): Promise<TimesheetLogFilterOptions> {
  const [clients, projects, sitesRaw, coordinators] = await Promise.all([
    db.client.findMany({ where: { deletedAt: null }, orderBy: { companyName: "asc" }, select: { id: true, companyName: true } }),
    db.project.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true, clientId: true } }),
    db.site.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, projectId: true, project: { select: { clientId: true } } },
    }),
    db.coordinator.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return {
    clients,
    projects,
    sites: sitesRaw.map((s) => ({ id: s.id, name: s.name, clientId: s.project.clientId, projectId: s.projectId })),
    coordinators,
  };
}

/**
 * One worker's month (§ monthly timesheet): every recorded day with its
 * site, plus the worker header. Rejected entries are returned too so the
 * page can show them, but the caller leaves them out of the totals.
 */
export async function getWorkerMonthlyTimesheet(user: SessionUser, workerId: string, month: string) {
  assertCan(user, "view", "timesheet");
  const [year, monthNum] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthNum - 1, 1));
  const end = new Date(Date.UTC(year, monthNum, 1));

  const [worker, items] = await Promise.all([
    db.worker.findFirst({
      where: { id: workerId, deletedAt: null },
      select: { id: true, fullName: true, iqamaNumber: true, designation: { select: { title: true } } },
    }),
    db.timesheetItem.findMany({
      where: { workerId, date: { gte: start, lt: end } },
      include: {
        otherLeaveType: { select: { name: true } },
        timesheet: { select: { id: true, status: true, site: { select: { name: true, project: { select: { client: { select: { companyName: true } } } } } } } },
      },
      orderBy: { date: "asc" },
    }),
  ]);
  return worker ? { worker, items, start, end } : null;
}

export async function listActiveLeaveTypesForSelect() {
  return db.leaveType.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}

/** Entries per attendance status for the current filters (legend counts), ignoring the status filter itself. */
export async function countTimesheetLogByAttendanceStatus(user: SessionUser, filters: TimesheetLogFilters = {}) {
  assertCan(user, "view", "timesheet");
  const rows = await db.timesheetItem.groupBy({
    by: ["attendanceStatus"],
    where: buildTimesheetLogWhere({ ...filters, attendanceStatus: "ALL" }),
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.attendanceStatus, r._count._all])) as Partial<Record<WorkerAttendanceStatus, number>>;
}
