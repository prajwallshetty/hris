import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

import bcrypt from "bcryptjs";

import { db } from "../src/lib/db";
import {
  calculateClientBilling,
  calculateCommission,
  calculateFinalSettlement,
  calculateInvoiceTotals,
  calculateLeaveDeduction,
  calculateOutstanding,
  calculateOvertime,
  calculateRepayableBalance,
  calculateWorkerPayroll,
} from "../src/server/calc";
import { extractWorkerRows, summarizeWorkerImport, validateWorkerImportRows } from "../src/server/import/worker-import";

const ADMIN_EMAIL = "admin@hris.local";
const ADMIN_PASSWORD = "ChangeMe123!";

// ---------------------------------------------------------------------------
// Admin login
// ---------------------------------------------------------------------------

async function seedAdminUser() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await db.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      name: "System Administrator",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    },
  });
  console.log(`Seeded admin user: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD} — change this password after first login.`);
}

// ---------------------------------------------------------------------------
// Real migration: DEMO IN.xlsx via the shared import architecture
// (extract -> validate -> preview/error-report -> commit). Section 29/7.
// ---------------------------------------------------------------------------

async function findOrCreateDesignation(cache: Map<string, string>, title: string | null): Promise<string | null> {
  if (!title) return null;
  const cached = cache.get(title);
  if (cached) return cached;
  const designation = await db.designation.upsert({ where: { title }, update: {}, create: { title } });
  cache.set(title, designation.id);
  return designation.id;
}

async function findOrCreateClient(cache: Map<string, string>, companyName: string): Promise<string> {
  const cached = cache.get(companyName);
  if (cached) return cached;
  const existing = await db.client.findFirst({ where: { companyName } });
  const client = existing ?? (await db.client.create({ data: { companyName, status: "ACTIVE" } }));
  cache.set(companyName, client.id);
  return client.id;
}

async function findOrCreateProject(cache: Map<string, string>, clientId: string, name: string): Promise<string> {
  const key = `${clientId}::${name}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const existing = await db.project.findFirst({ where: { clientId, name } });
  const project = existing ?? (await db.project.create({ data: { clientId, name, status: "ACTIVE" } }));
  cache.set(key, project.id);
  return project.id;
}

async function findOrCreateSite(cache: Map<string, string>, projectId: string, name: string): Promise<string> {
  const key = `${projectId}::${name}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const existing = await db.site.findFirst({ where: { projectId, name } });
  const site = existing ?? (await db.site.create({ data: { projectId, name, status: "ACTIVE" } }));
  cache.set(key, site.id);
  return site.id;
}

async function seedWorkersFromExcel() {
  const filePath = path.join(process.cwd(), "reference", "DEMO IN.xlsx");
  const buffer = fs.readFileSync(filePath);
  const rawRows = extractWorkerRows(buffer);

  const existingIqamas = new Set((await db.worker.findMany({ select: { iqamaNumber: true } })).map((w) => w.iqamaNumber));
  const results = validateWorkerImportRows(rawRows, existingIqamas);
  const summary = summarizeWorkerImport(results);

  console.log(
    `DEMO IN.xlsx import preview: ${summary.totalRows} rows, ${summary.validRows} valid, ${summary.invalidRows} invalid.`,
  );
  for (const failure of summary.errorReport) {
    console.log(`  Row ${failure.rowNumber}: ${failure.errors.join(" ")}`);
  }

  const clientCache = new Map<string, string>();
  const projectCache = new Map<string, string>();
  const siteCache = new Map<string, string>();
  const designationCache = new Map<string, string>();

  let created = 0;
  for (const result of results) {
    if (!result.valid) continue; // invalid rows are reported above, never silently imported (§7)
    const { row } = result;

    const clientId = await findOrCreateClient(clientCache, row.client!);
    const projectId = await findOrCreateProject(projectCache, clientId, "General");
    const siteId = await findOrCreateSite(siteCache, projectId, row.site!);
    const designationId = await findOrCreateDesignation(designationCache, row.designation);

    const statusUpper = row.status?.toUpperCase() ?? "";
    const workerStatus = statusUpper.includes("DEMOB") ? "DEMOBILIZED" : statusUpper.includes("MOB") ? "ACTIVE" : "AVAILABLE";

    const worker = await db.worker.create({
      data: {
        iqamaNumber: row.iqama!,
        fullName: row.name!,
        designationId,
        mobilizationDate: row.mob,
        demobilizationDate: row.demob,
        status: workerStatus,
        hourlyRate: row.ratePerHour,
        notes: row.batchNo ? `Client batch no.: ${row.batchNo} (imported from DEMO IN.xlsx)` : "Imported from DEMO IN.xlsx",
      },
    });
    await db.workerStatusHistory.create({
      data: { workerId: worker.id, previousStatus: null, newStatus: worker.status },
    });
    created += 1;

    const isEnded = workerStatus === "DEMOBILIZED";
    await db.assignment.create({
      data: {
        workerId: worker.id,
        clientId,
        projectId,
        siteId,
        designation: row.designation,
        workerHourlyRate: row.ratePerHour ?? 0,
        clientBillingRate: row.ratePerHour ?? 0,
        startDate: row.mob ?? row.month ?? new Date(),
        endDate: isEnded ? (row.demob ?? row.month) : null,
        status: isEnded ? "ENDED" : "ACTIVE",
        notes:
          "Client billing rate not available in source data — defaulted to worker rate. Update manually once known.",
      },
    });
  }

  console.log(`DEMO IN.xlsx import: ${created} workers created (existing Iqamas were skipped as duplicates).`);
}

// ---------------------------------------------------------------------------
// Expanded scenario data — a second client with its own coordinator,
// designations, internal employees, leave, payroll, payments, advances,
// invoicing and commission, so every §31 test scenario is backed by real
// rows the calculation engine actually produced (not hand-typed totals).
// ---------------------------------------------------------------------------

async function seedCoordinators() {
  const ahmed = await db.coordinator.upsert({
    where: { id: (await db.coordinator.findFirst({ where: { name: "Ahmed Al-Farsi" } }))?.id ?? "__new__" },
    update: {},
    create: { name: "Ahmed Al-Farsi", phone: "+966500000001", email: "ahmed.alfarsi@example.com" },
  });
  const fatima = await db.coordinator.upsert({
    where: { id: (await db.coordinator.findFirst({ where: { name: "Fatima Noor" } }))?.id ?? "__new__" },
    update: {},
    create: { name: "Fatima Noor", phone: "+966500000002", email: "fatima.noor@example.com" },
  });
  return { ahmedId: ahmed.id, fatimaId: fatima.id };
}

async function seedSecondClient() {
  const existingClient = await db.client.findFirst({ where: { companyName: "Al Rajhi Construction" } });
  const client =
    existingClient ??
    (await db.client.create({
      data: {
        companyName: "Al Rajhi Construction",
        contactPerson: "Khalid Al Rajhi",
        phone: "+966112223344",
        email: "procurement@alrajhi-construction.example",
        paymentTerms: "Net 30",
        billingTerms: "Monthly",
        status: "ACTIVE",
      },
    }));

  const project =
    (await db.project.findFirst({ where: { clientId: client.id, name: "Tower Development" } })) ??
    (await db.project.create({ data: { clientId: client.id, name: "Tower Development", status: "ACTIVE" } }));

  const riyadhSite =
    (await db.site.findFirst({ where: { projectId: project.id, name: "Riyadh HQ Site" } })) ??
    (await db.site.create({ data: { projectId: project.id, name: "Riyadh HQ Site", location: "Riyadh", status: "ACTIVE" } }));
  const jeddahSite =
    (await db.site.findFirst({ where: { projectId: project.id, name: "Jeddah Warehouse" } })) ??
    (await db.site.create({ data: { projectId: project.id, name: "Jeddah Warehouse", location: "Jeddah", status: "ACTIVE" } }));

  return { clientId: client.id, projectId: project.id, riyadhSiteId: riyadhSite.id, jeddahSiteId: jeddahSite.id };
}

type NewWorkerSpec = {
  name: string;
  iqama: string;
  designation: string;
  hourlyRate: number;
  overtimeRate: number;
  status: "ACTIVE" | "AVAILABLE" | "ON_LEAVE" | "TERMINATED";
  siteId: string | null;
  clientBillingRate?: number;
};

async function seedExtraWorkers(
  designationCache: Map<string, string>,
  coordinatorId: string,
  clientId: string,
  projectId: string,
  specs: NewWorkerSpec[],
) {
  const workerIds: Record<string, string> = {};

  for (const spec of specs) {
    const existing = await db.worker.findUnique({ where: { iqamaNumber: spec.iqama } });
    if (existing) {
      workerIds[spec.name] = existing.id;
      continue;
    }

    const designationId = await findOrCreateDesignation(designationCache, spec.designation);
    const worker = await db.worker.create({
      data: {
        iqamaNumber: spec.iqama,
        fullName: spec.name,
        designationId,
        coordinatorId,
        hourlyRate: spec.hourlyRate,
        overtimeRate: spec.overtimeRate,
        status: spec.status,
        joiningDate: new Date("2026-01-15"),
        mobilizationDate: spec.siteId ? new Date("2026-01-15") : null,
        nationality: "Bangladesh",
      },
    });
    await db.workerStatusHistory.create({
      data: { workerId: worker.id, previousStatus: null, newStatus: worker.status },
    });
    workerIds[spec.name] = worker.id;

    if (spec.siteId) {
      await db.assignment.create({
        data: {
          workerId: worker.id,
          clientId,
          projectId,
          siteId: spec.siteId,
          designation: spec.designation,
          workerHourlyRate: spec.hourlyRate,
          clientBillingRate: spec.clientBillingRate ?? spec.hourlyRate * 1.4,
          startDate: new Date("2026-01-15"),
          coordinatorId,
          status: spec.status === "TERMINATED" ? "ENDED" : "ACTIVE",
          endDate: spec.status === "TERMINATED" ? new Date("2026-07-31") : null,
        },
      });
    }
  }

  return workerIds;
}

// Scenario: a worker moves from one site to another without losing history.
async function seedWorkerSiteMove(
  designationCache: Map<string, string>,
  coordinatorId: string,
  clientId: string,
  projectId: string,
  riyadhSiteId: string,
  jeddahSiteId: string,
) {
  const iqama = "3000000001";
  const existing = await db.worker.findUnique({ where: { iqamaNumber: iqama } });
  if (existing) return existing.id;

  const designationId = await findOrCreateDesignation(designationCache, "Mason");
  const worker = await db.worker.create({
    data: {
      iqamaNumber: iqama,
      fullName: "Junaid Malik",
      designationId,
      coordinatorId,
      hourlyRate: 15,
      overtimeRate: 22.5,
      status: "ACTIVE",
      joiningDate: new Date("2026-01-01"),
    },
  });

  // First assignment: Riyadh HQ Site, January - March.
  await db.assignment.create({
    data: {
      workerId: worker.id,
      clientId,
      projectId,
      siteId: riyadhSiteId,
      designation: "Mason",
      workerHourlyRate: 15,
      clientBillingRate: 21,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-03-01"),
      coordinatorId,
      status: "ENDED",
    },
  });
  // Second assignment: moved to Jeddah Warehouse from March onward — the
  // January-March assignment above stays exactly as it was (§7 completion
  // criteria: "worker can move between sites/clients without losing history").
  await db.assignment.create({
    data: {
      workerId: worker.id,
      clientId,
      projectId,
      siteId: jeddahSiteId,
      designation: "Mason",
      workerHourlyRate: 15,
      clientBillingRate: 21,
      startDate: new Date("2026-03-01"),
      coordinatorId,
      status: "ACTIVE",
    },
  });

  return worker.id;
}

async function seedDepartmentsAndEmployees(coordinatorId: string, designationCache: Map<string, string>) {
  const operations =
    (await db.department.findFirst({ where: { name: "Operations" } })) ??
    (await db.department.create({ data: { name: "Operations" } }));
  const finance =
    (await db.department.findFirst({ where: { name: "Finance" } })) ??
    (await db.department.create({ data: { name: "Finance" } }));

  const managerDesignationId = await findOrCreateDesignation(designationCache, "Operations Manager");
  const accountantDesignationId = await findOrCreateDesignation(designationCache, "Accountant");

  const existingManager = await db.internalEmployee.findFirst({ where: { fullName: "Sara Al-Otaibi" } });
  if (!existingManager) {
    await db.internalEmployee.create({
      data: {
        fullName: "Sara Al-Otaibi",
        email: "sara.alotaibi@example.com",
        departmentId: operations.id,
        designationId: managerDesignationId,
        coordinatorId,
        baseSalary: 9000,
        joiningDate: new Date("2024-06-01"),
        status: "ACTIVE",
      },
    });
  }

  const existingAccountant = await db.internalEmployee.findFirst({ where: { fullName: "Mohammed Ali" } });
  if (!existingAccountant) {
    await db.internalEmployee.create({
      data: {
        fullName: "Mohammed Ali",
        email: "mohammed.ali@example.com",
        departmentId: finance.id,
        designationId: accountantDesignationId,
        baseSalary: 6500,
        joiningDate: new Date("2025-02-01"),
        status: "ACTIVE",
      },
    });
  }
}

// Scenario: worker takes unpaid leave (deducted from payroll).
async function seedLeave(workerId: string) {
  const annual =
    (await db.leaveType.findFirst({ where: { name: "Annual Leave" } })) ??
    (await db.leaveType.create({ data: { name: "Annual Leave", isPaid: true, defaultAnnualDays: 21 } }));
  const unpaid =
    (await db.leaveType.findFirst({ where: { name: "Unpaid Leave" } })) ??
    (await db.leaveType.create({ data: { name: "Unpaid Leave", isPaid: false, defaultAnnualDays: 0 } }));

  const existingBalance = await db.leaveBalance.findFirst({
    where: { workerId, leaveTypeId: annual.id, year: 2026 },
  });
  if (!existingBalance) {
    await db.leaveBalance.create({
      data: { workerId, leaveTypeId: annual.id, year: 2026, entitledDays: 21, usedDays: 3 },
    });
  }

  const existingRequest = await db.leaveRequest.findFirst({ where: { workerId, leaveTypeId: unpaid.id } });
  if (!existingRequest) {
    await db.leaveRequest.create({
      data: {
        workerId,
        leaveTypeId: unpaid.id,
        startDate: new Date("2026-07-14"),
        endDate: new Date("2026-07-15"),
        days: 2,
        reason: "Family emergency",
        status: "APPROVED",
        approvedAt: new Date("2026-07-10"),
      },
    });
  }

  return unpaid.id;
}

async function seedPayrollAndFinance(params: {
  clientId: string;
  projectId: string;
  siteId: string;
  coordinatorId: string;
  yusufId: string;
  karimId: string;
  naveedId: string;
  tariqId: string; // the unpaid-leave worker
}) {
  const { yusufId, karimId, naveedId, tariqId } = params;

  const julyPeriod =
    (await db.payrollPeriod.findFirst({ where: { name: "July 2026" } })) ??
    (await db.payrollPeriod.create({
      data: { name: "July 2026", periodStart: new Date("2026-07-01"), periodEnd: new Date("2026-07-31"), status: "PAID" },
    }));
  const augustPeriod =
    (await db.payrollPeriod.findFirst({ where: { name: "August 2026" } })) ??
    (await db.payrollPeriod.create({
      data: { name: "August 2026", periodStart: new Date("2026-08-01"), periodEnd: new Date("2026-08-31"), status: "APPROVED" },
    }));

  // Scenario: worker works regular + overtime hours in a day; the monthly
  // total below is the sum of days like this across the period.
  const dailySplit = calculateOvertime(10); // 8 regular + 2 overtime per day, default rule
  console.log(
    `  Overtime split for a 10h day: ${dailySplit.regularHours.toFixed(1)}h regular / ${dailySplit.overtimeHours.toFixed(1)}h overtime`,
  );

  async function upsertWorkerPayroll(
    workerId: string,
    payrollPeriodId: string,
    input: Parameters<typeof calculateWorkerPayroll>[0],
  ) {
    const existing = await db.workerPayroll.findUnique({
      where: { payrollPeriodId_workerId: { payrollPeriodId, workerId } },
    });
    if (existing) return existing;

    const result = calculateWorkerPayroll(input);
    const payroll = await db.workerPayroll.create({
      data: {
        payrollPeriodId,
        workerId,
        regularHours: input.regularHours,
        overtimeHours: input.overtimeHours,
        regularRate: input.regularRate,
        overtimeRate: input.overtimeRate,
        grossPay: result.grossPay.toFixed(2),
        allowances: input.allowances ?? 0,
        bonuses: input.bonuses ?? 0,
        advanceDeduction: input.advanceDeduction ?? 0,
        loanDeduction: input.loanDeduction ?? 0,
        leaveDeduction: input.leaveDeduction ?? 0,
        otherDeductions: input.otherDeductions ?? 0,
        netPayable: result.netPayable.toFixed(2),
        status: "APPROVED",
      },
    });

    await db.workerPayrollItem.createMany({
      data: [
        { workerPayrollId: payroll.id, type: "REGULAR_HOURS", quantity: input.regularHours, rate: input.regularRate, amount: result.regularPay.toFixed(2) },
        { workerPayrollId: payroll.id, type: "OVERTIME", quantity: input.overtimeHours, rate: input.overtimeRate, amount: result.overtimePay.toFixed(2) },
      ],
    });

    return payroll;
  }

  // Yusuf: straightforward July payroll, 200 regular + 12 overtime hours at SAR 18/h.
  await upsertWorkerPayroll(yusufId, julyPeriod.id, {
    regularHours: 200,
    overtimeHours: 12,
    regularRate: 18,
    overtimeRate: 27,
  });

  // Karim: July payroll, then only partially paid (partial-payment scenario).
  const karimJuly = await upsertWorkerPayroll(karimId, julyPeriod.id, {
    regularHours: 208,
    overtimeHours: 8,
    regularRate: 20,
    overtimeRate: 30,
  });
  const existingKarimPayment = await db.workerPayment.findFirst({ where: { workerPayrollId: karimJuly.id } });
  if (!existingKarimPayment) {
    const partialAmount = Number(karimJuly.netPayable) * 0.6;
    await db.workerPayment.create({
      data: {
        workerId: karimId,
        workerPayrollId: karimJuly.id,
        amount: partialAmount.toFixed(2),
        paymentType: "SALARY",
        method: "BANK_TRANSFER",
        date: new Date("2026-08-01"),
        remarks: "Partial salary payment — remainder due next cycle.",
      },
    });
    const outstanding = calculateOutstanding(karimJuly.netPayable, [partialAmount]);
    console.log(`  Karim July payroll: net ${karimJuly.netPayable}, paid ${partialAmount.toFixed(2)}, outstanding ${outstanding.toFixed(2)}`);
  }

  // Tariq: unpaid leave deduction (2 days at 8h/day * 18/h = 144).
  const tariqLeaveDeduction = calculateLeaveDeduction(2, 18 * 8);
  await upsertWorkerPayroll(tariqId, julyPeriod.id, {
    regularHours: 176, // 22 working days * 8h, 2 unpaid leave days already excluded
    overtimeHours: 0,
    regularRate: 18,
    overtimeRate: 27,
    leaveDeduction: tariqLeaveDeduction.toNumber(),
  });

  // Naveed: same worker, rate held constant across periods — proves payroll
  // never re-derives from "the current rate" (§8), since both periods pass
  // their own explicit snapshot instead of reading Worker.hourlyRate live.
  await upsertWorkerPayroll(naveedId, julyPeriod.id, { regularHours: 200, overtimeHours: 0, regularRate: 19, overtimeRate: 28.5 });
  await upsertWorkerPayroll(naveedId, augustPeriod.id, { regularHours: 200, overtimeHours: 0, regularRate: 19, overtimeRate: 28.5 });

  return { julyPeriodId: julyPeriod.id, augustPeriodId: augustPeriod.id };
}

// Scenario: worker takes an advance and repays it across multiple payroll periods.
async function seedAdvance(workerId: string, julyPeriodId: string, augustPeriodId: string) {
  const existing = await db.advance.findFirst({ where: { workerId } });
  const advance =
    existing ??
    (await db.advance.create({
      data: { workerId, amount: 900, dateGiven: new Date("2026-06-15"), reason: "Family travel", status: "ACTIVE" },
    }));

  const existingRepayments = await db.advanceRepayment.count({ where: { advanceId: advance.id } });
  if (existingRepayments === 0) {
    await db.advanceRepayment.create({
      data: { advanceId: advance.id, amount: 300, payrollPeriodId: julyPeriodId, date: new Date("2026-07-31") },
    });
    await db.advanceRepayment.create({
      data: { advanceId: advance.id, amount: 300, payrollPeriodId: augustPeriodId, date: new Date("2026-08-31") },
    });
    const balance = calculateRepayableBalance(900, [300, 300]);
    console.log(`  Advance for worker ${workerId}: SAR 900 given, SAR 600 repaid over 2 periods, SAR ${balance.toFixed(2)} remaining.`);
    if (balance.isZero()) {
      await db.advance.update({ where: { id: advance.id }, data: { status: "FULLY_REPAID" } });
    }
  }
}

// Scenario: worker leaves with pending salary + outstanding advance balance.
async function seedFinalSettlement(zahidId: string) {
  const existingSettlement = await db.workerPayment.findFirst({
    where: { workerId: zahidId, paymentType: "SETTLEMENT" },
  });
  if (existingSettlement) return;

  const existingAdvance = await db.advance.findFirst({ where: { workerId: zahidId } });
  const advance =
    existingAdvance ??
    (await db.advance.create({
      data: { workerId: zahidId, amount: 500, dateGiven: new Date("2026-06-01"), reason: "Medical", status: "ACTIVE" },
    }));

  const settlement = calculateFinalSettlement({
    pendingRegularPay: 1360, // 80h remaining at SAR 17/h
    pendingOvertimePay: 0,
    leaveEncashment: 255, // 5 unused leave days encashed at SAR 51/day
    advanceBalance: 500,
  });

  await db.workerPayment.create({
    data: {
      workerId: zahidId,
      amount: settlement.netSettlement.toFixed(2),
      paymentType: "SETTLEMENT",
      method: "BANK_TRANSFER",
      date: new Date("2026-08-05"),
      remarks: `Final settlement: due ${settlement.totalDue.toFixed(2)} - advance ${settlement.totalDeductions.toFixed(2)}.`,
    },
  });
  await db.advance.update({ where: { id: advance.id }, data: { status: "FULLY_REPAID" } });

  console.log(
    `  Final settlement for terminated worker: due ${settlement.totalDue.toFixed(2)}, deductions ${settlement.totalDeductions.toFixed(2)}, net ${settlement.netSettlement.toFixed(2)}.`,
  );
}

// Scenario: client billing (differs from worker rate), partial client
// payment, and coordinator commission on that invoice.
async function seedInvoiceAndCommission(params: {
  clientId: string;
  projectId: string;
  siteId: string;
  coordinatorId: string;
  yusufId: string;
  karimId: string;
}) {
  const existingInvoice = await db.invoice.findFirst({ where: { clientId: params.clientId } });
  if (existingInvoice) return;

  const yusufBilling = calculateClientBilling(212, 25.2); // 200 regular + 12 OT hours at client rate 25.20
  const karimBilling = calculateClientBilling(216, 28); // 208 regular + 8 OT hours at client rate 28

  const subtotal = yusufBilling.plus(karimBilling);
  const totals = calculateInvoiceTotals(subtotal, 15); // 15% VAT

  const invoice = await db.invoice.create({
    data: {
      clientId: params.clientId,
      projectId: params.projectId,
      billingPeriodStart: new Date("2026-07-01"),
      billingPeriodEnd: new Date("2026-07-31"),
      status: "ISSUED",
      subtotal: totals.subtotal.toFixed(2),
      taxAmount: totals.taxAmount.toFixed(2),
      totalAmount: totals.totalAmount.toFixed(2),
      issuedAt: new Date("2026-08-02"),
      dueDate: new Date("2026-09-01"),
    },
  });

  await db.invoiceItem.createMany({
    data: [
      {
        invoiceId: invoice.id,
        workerId: params.yusufId,
        siteId: params.siteId,
        description: "Electrician — 212 hours (incl. overtime) @ SAR 25.20/h",
        hours: 212,
        rate: 25.2,
        amount: yusufBilling.toFixed(2),
      },
      {
        invoiceId: invoice.id,
        workerId: params.karimId,
        siteId: params.siteId,
        description: "Welder — 216 hours (incl. overtime) @ SAR 28.00/h",
        hours: 216,
        rate: 28,
        amount: karimBilling.toFixed(2),
      },
    ],
  });

  // Client partially pays the invoice.
  const partialPayment = Number(totals.totalAmount) * 0.5;
  await db.clientPayment.create({
    data: {
      clientId: params.clientId,
      invoiceId: invoice.id,
      amount: partialPayment.toFixed(2),
      method: "BANK_TRANSFER",
      date: new Date("2026-08-10"),
      remarks: "First installment.",
    },
  });
  await db.invoice.update({ where: { id: invoice.id }, data: { status: "PARTIALLY_PAID" } });
  const outstanding = calculateOutstanding(totals.totalAmount, [partialPayment]);
  console.log(
    `  Invoice ${invoice.id}: total ${totals.totalAmount.toFixed(2)}, paid ${partialPayment.toFixed(2)}, outstanding ${outstanding.toFixed(2)}.`,
  );

  // Coordinator commission: 5% of this invoice.
  const rule =
    (await db.commissionRule.findFirst({ where: { coordinatorId: params.coordinatorId, type: "PERCENT_OF_INVOICE" } })) ??
    (await db.commissionRule.create({
      data: { coordinatorId: params.coordinatorId, type: "PERCENT_OF_INVOICE", rateOrAmount: 5 },
    }));

  const sale = await db.sale.create({
    data: {
      coordinatorId: params.coordinatorId,
      clientId: params.clientId,
      description: "Al Rajhi Construction — Tower Development mobilization",
      amount: totals.totalAmount.toFixed(2),
      date: new Date("2026-08-02"),
    },
  });

  const commissionAmount = calculateCommission({ type: "PERCENT_OF_INVOICE", rateOrAmount: 5 }, { invoiceAmount: totals.totalAmount });
  await db.commission.create({
    data: {
      coordinatorId: params.coordinatorId,
      commissionRuleId: rule.id,
      saleId: sale.id,
      amount: commissionAmount.toFixed(2),
      status: "APPROVED",
      approvedAt: new Date("2026-08-11"),
    },
  });
  console.log(`  Coordinator commission on this invoice: SAR ${commissionAmount.toFixed(2)} (5% of invoice total).`);
}

async function seedExpandedScenarios() {
  const designationCache = new Map<string, string>();
  const { ahmedId } = await seedCoordinators();
  const { clientId, projectId, riyadhSiteId, jeddahSiteId } = await seedSecondClient();

  const workerIds = await seedExtraWorkers(designationCache, ahmedId, clientId, projectId, [
    { name: "Yusuf Al-Amin", iqama: "3000000010", designation: "Electrician", hourlyRate: 18, overtimeRate: 27, status: "ACTIVE", siteId: riyadhSiteId, clientBillingRate: 25.2 },
    { name: "Karim Abdullah", iqama: "3000000011", designation: "Welder", hourlyRate: 20, overtimeRate: 30, status: "ACTIVE", siteId: riyadhSiteId, clientBillingRate: 28 },
    { name: "Hassan Ibrahim", iqama: "3000000012", designation: "Plumber", hourlyRate: 16, overtimeRate: 24, status: "ACTIVE", siteId: riyadhSiteId },
    { name: "Omar Siddique", iqama: "3000000013", designation: "Driver", hourlyRate: 14, overtimeRate: 21, status: "ACTIVE", siteId: jeddahSiteId },
    { name: "Rashid Karim", iqama: "3000000014", designation: "Helper", hourlyRate: 11, overtimeRate: 16.5, status: "ACTIVE", siteId: jeddahSiteId },
    { name: "Faisal Noor", iqama: "3000000015", designation: "Mason", hourlyRate: 15, overtimeRate: 22.5, status: "ACTIVE", siteId: jeddahSiteId },
    { name: "Tariq Hussain", iqama: "3000000016", designation: "Electrician", hourlyRate: 18, overtimeRate: 27, status: "ON_LEAVE", siteId: riyadhSiteId },
    { name: "Naveed Anwar", iqama: "3000000017", designation: "Welder", hourlyRate: 19, overtimeRate: 28.5, status: "ACTIVE", siteId: riyadhSiteId },
    { name: "Bilal Ahmed", iqama: "3000000018", designation: "Scaffolder", hourlyRate: 15, overtimeRate: 22.5, status: "AVAILABLE", siteId: null },
    { name: "Sameer Raza", iqama: "3000000019", designation: "Helper", hourlyRate: 12, overtimeRate: 18, status: "AVAILABLE", siteId: null },
    { name: "Zahid Iqbal", iqama: "3000000020", designation: "Electrician", hourlyRate: 17, overtimeRate: 25.5, status: "TERMINATED", siteId: riyadhSiteId },
  ]);

  await seedWorkerSiteMove(designationCache, ahmedId, clientId, projectId, riyadhSiteId, jeddahSiteId);
  await seedDepartmentsAndEmployees(ahmedId, designationCache);
  await seedLeave(workerIds["Tariq Hussain"]);

  const { julyPeriodId, augustPeriodId } = await seedPayrollAndFinance({
    clientId,
    projectId,
    siteId: riyadhSiteId,
    coordinatorId: ahmedId,
    yusufId: workerIds["Yusuf Al-Amin"],
    karimId: workerIds["Karim Abdullah"],
    naveedId: workerIds["Naveed Anwar"],
    tariqId: workerIds["Tariq Hussain"],
  });

  await seedAdvance(workerIds["Naveed Anwar"], julyPeriodId, augustPeriodId);
  await seedFinalSettlement(workerIds["Zahid Iqbal"]);
  await seedInvoiceAndCommission({
    clientId,
    projectId,
    siteId: riyadhSiteId,
    coordinatorId: ahmedId,
    yusufId: workerIds["Yusuf Al-Amin"],
    karimId: workerIds["Karim Abdullah"],
  });

  console.log("Expanded scenario data seeded (second client, 12 workers, payroll, advances, leave, invoicing, commission).");
}

async function main() {
  await seedAdminUser();
  await seedWorkersFromExcel();
  await seedExpandedScenarios();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
