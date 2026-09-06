import { db } from "@/lib/db";
import { calculateOutstanding } from "@/server/calc";
import { calculateRentalTotal } from "@/server/calc/rental";
import { can, clientScopeWhere, workerScopeWhere, type SessionUser } from "@/server/rbac";
import {
  listUpcomingEquipmentDocumentExpiries,
  listUpcomingEquipmentMaintenance,
  listOverdueRentals,
} from "@/server/queries/equipment";
import { listUpcomingVehicleDocumentExpiries, listUpcomingVehicleMaintenance } from "@/server/queries/vehicles";

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

  if (can(user, "view", "vehicleMaintenance")) {
    const { documents: vehicleDocs, vehicles: vehicleExpiries } = await listUpcomingVehicleDocumentExpiries(EXPIRY_WINDOW_DAYS);
    for (const doc of vehicleDocs) {
      const expired = doc.expiryDate! < new Date();
      items.push({
        id: `vehicle-doc-${doc.id}`,
        severity: expired ? "critical" : "warning",
        title: expired ? "Vehicle document expired" : "Vehicle document expiring soon",
        message: `${doc.vehicle.plateNumber}'s ${doc.documentType.toLowerCase()} document ${expired ? "expired" : "expires"} on ${doc.expiryDate!.toLocaleDateString("en-GB")}.`,
        href: `/vehicles/${doc.vehicleId}`,
        date: doc.expiryDate!,
      });
    }
    for (const vehicle of vehicleExpiries) {
      const fields: [Date | null, string][] = [
        [vehicle.registrationExpiry, "Registration"],
        [vehicle.insuranceExpiry, "Insurance"],
        [vehicle.inspectionExpiry, "Inspection"],
      ];
      for (const [expiry, label] of fields) {
        if (!expiry || expiry > soon) continue;
        const expired = expiry < new Date();
        items.push({
          id: `vehicle-${label}-${vehicle.id}`,
          severity: expired ? "critical" : "warning",
          title: expired ? `${label} expired` : `${label} expiring soon`,
          message: `${vehicle.plateNumber}'s ${label.toLowerCase()} ${expired ? "expired" : "expires"} on ${expiry.toLocaleDateString("en-GB")}.`,
          href: `/vehicles/${vehicle.id}`,
          date: expiry,
        });
      }
    }

    const dueMaintenance = await listUpcomingVehicleMaintenance(EXPIRY_WINDOW_DAYS);
    for (const m of dueMaintenance) {
      items.push({
        id: `vehicle-maintenance-${m.id}`,
        severity: m.nextServiceDate! < new Date() ? "critical" : "warning",
        title: "Vehicle maintenance due",
        message: `${m.vehicle.plateNumber} is due for ${m.maintenanceType} on ${m.nextServiceDate!.toLocaleDateString("en-GB")}.`,
        href: `/vehicles/${m.vehicleId}`,
        date: m.nextServiceDate!,
      });
    }
  }

  if (can(user, "view", "equipmentMaintenance")) {
    const equipmentDocs = await listUpcomingEquipmentDocumentExpiries(EXPIRY_WINDOW_DAYS);
    for (const doc of equipmentDocs) {
      const expired = doc.expiryDate! < new Date();
      items.push({
        id: `equipment-doc-${doc.id}`,
        severity: expired ? "critical" : "warning",
        title: expired ? "Equipment document expired" : "Equipment document expiring soon",
        message: `${doc.equipment.name}'s ${doc.documentType.toLowerCase()} document ${expired ? "expired" : "expires"} on ${doc.expiryDate!.toLocaleDateString("en-GB")}.`,
        href: `/equipment/${doc.equipmentId}`,
        date: doc.expiryDate!,
      });
    }

    const dueMaintenance = await listUpcomingEquipmentMaintenance(EXPIRY_WINDOW_DAYS);
    for (const m of dueMaintenance) {
      items.push({
        id: `equipment-maintenance-${m.id}`,
        severity: m.nextServiceDate! < new Date() ? "critical" : "warning",
        title: "Equipment maintenance due",
        message: `${m.equipment.name} is due for ${m.maintenanceType} on ${m.nextServiceDate!.toLocaleDateString("en-GB")}.`,
        href: `/equipment/${m.equipmentId}`,
        date: m.nextServiceDate!,
      });
    }
  }

  if (can(user, "view", "equipmentRental")) {
    const overdueRentals = (await listOverdueRentals()).filter((rental) => {
      if (user.role === "COORDINATOR") return rental.coordinatorId === user.coordinatorId;
      if (user.role === "CLIENT") return rental.clientId === user.clientId;
      return true;
    });
    for (const rental of overdueRentals) {
      items.push({
        id: `rental-overdue-${rental.id}`,
        severity: "critical",
        title: "Rental return overdue",
        message: `${rental.equipment.name} rented to ${rental.client.companyName} was due back on ${rental.expectedEndDate!.toLocaleDateString("en-GB")}.`,
        href: `/rentals/${rental.id}`,
        date: rental.expectedEndDate!,
      });
    }

    const returnedRentals = await db.equipmentRental.findMany({
      where: {
        status: "RETURNED",
        ...(user.role === "COORDINATOR" ? { coordinatorId: user.coordinatorId ?? "__none__" } : {}),
        ...(user.role === "CLIENT" ? { clientId: user.clientId ?? "__none__" } : {}),
      },
      include: { charges: true, payments: true, equipment: true, client: true },
      take: 30,
    });
    for (const rental of returnedRentals) {
      const total = calculateRentalTotal(rental.charges.map((c) => c.amount.toString()));
      const outstanding = calculateOutstanding(total, rental.payments.map((p) => p.amount.toString()));
      if (outstanding.gt(0)) {
        items.push({
          id: `rental-payment-due-${rental.id}`,
          severity: "warning",
          title: "Rental payment due",
          message: `${rental.client.companyName} has SAR ${outstanding.toFixed(2)} outstanding for the ${rental.equipment.name} rental.`,
          href: `/rentals/${rental.id}`,
          date: rental.updatedAt,
        });
      }
    }
  }

  return items.sort((a, b) => a.date.getTime() - b.date.getTime());
}
