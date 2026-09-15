import "dotenv/config";

import { accessCodeLookupHash, hashAccessCode } from "../src/lib/access-code";
import { db } from "../src/lib/db";

const KNOWN_ACCESS_CODE = "SA-9999";

async function main() {
  const accessCodeHash = await hashAccessCode(KNOWN_ACCESS_CODE);

  const admin = await db.user.upsert({
    where: { email: "test-admin@hris.local" },
    update: {
      accessCodeHash,
      accessCodeLookupHash: accessCodeLookupHash(KNOWN_ACCESS_CODE),
      accessCodeSetAt: new Date(),
      status: "ACTIVE",
    },
    create: {
      email: "test-admin@hris.local",
      name: "Test Admin",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      accessCodeHash,
      accessCodeLookupHash: accessCodeLookupHash(KNOWN_ACCESS_CODE),
      accessCodeSetAt: new Date(),
    },
  });
  console.log("Test admin user:", admin.email, "access code:", KNOWN_ACCESS_CODE);

  const client = await db.client.upsert({
    where: { id: "test-client-1" },
    update: {},
    create: {
      id: "test-client-1",
      companyName: "ABC Contracting",
      status: "ACTIVE",
    },
  });

  const project = await db.project.upsert({
    where: { id: "test-project-1" },
    update: {},
    create: { id: "test-project-1", clientId: client.id, name: "Riyadh Maintenance", status: "ACTIVE" },
  });

  const site = await db.site.upsert({
    where: { id: "test-site-1" },
    update: {},
    create: { id: "test-site-1", projectId: project.id, name: "King Abdullah Site", status: "ACTIVE" },
  });

  const coordinator = await db.coordinator.upsert({
    where: { id: "test-coord-1" },
    update: {},
    create: { id: "test-coord-1", name: "Ahmed Khan", status: "ACTIVE" },
  });

  const worker = await db.worker.upsert({
    where: { id: "test-worker-1" },
    update: {},
    create: {
      id: "test-worker-1",
      fullName: "Mohammed Ahmed",
      iqamaNumber: "2345678901",
      status: "ACTIVE",
    },
  });

  const existingAssignment = await db.assignment.findFirst({ where: { workerId: worker.id, status: "ACTIVE" } });
  if (!existingAssignment) {
    await db.assignment.create({
      data: {
        workerId: worker.id,
        clientId: client.id,
        projectId: project.id,
        siteId: site.id,
        coordinatorId: coordinator.id,
        workerHourlyRate: 10,
        clientBillingRate: 15,
        startDate: new Date("2026-09-01"),
        status: "ACTIVE",
      },
    });
    console.log("Created test assignment for", worker.fullName);
  } else {
    console.log("Test assignment already exists for", worker.fullName);
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
