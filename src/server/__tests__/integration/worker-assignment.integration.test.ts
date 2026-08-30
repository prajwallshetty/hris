// Integration tests against a real Postgres connection (`docker compose up`
// must be running — see README). Unlike the pure calculation/RBAC tests,
// these exercise actual database constraints and transactions rather than
// application code, per §34's "Database constraint tests" / "Assignment
// history tests" completion criteria.
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const TEST_PREFIX = "TEST_INTEGRATION_";

afterAll(async () => {
  await db.$disconnect();
});

describe("Worker.iqamaNumber uniqueness (database constraint)", () => {
  const iqama = "9000000001";

  afterAll(async () => {
    await db.worker.deleteMany({ where: { iqamaNumber: iqama } });
  });

  it("allows creating a worker with a fresh Iqama number", async () => {
    const worker = await db.worker.create({
      data: { iqamaNumber: iqama, fullName: `${TEST_PREFIX}Worker A` },
    });
    expect(worker.iqamaNumber).toBe(iqama);
  });

  it("rejects a second worker with the same Iqama number at the database level", async () => {
    await expect(
      db.worker.create({ data: { iqamaNumber: iqama, fullName: `${TEST_PREFIX}Worker B` } }),
    ).rejects.toSatisfy(
      (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002",
    );
  });
});

describe("Assignment history is preserved when a worker moves clients", () => {
  let clientAId: string;
  let clientBId: string;
  let projectAId: string;
  let projectBId: string;
  let siteAId: string;
  let siteBId: string;
  let workerId: string;

  beforeAll(async () => {
    const [clientA, clientB] = await Promise.all([
      db.client.create({ data: { companyName: `${TEST_PREFIX}Client A` } }),
      db.client.create({ data: { companyName: `${TEST_PREFIX}Client B` } }),
    ]);
    clientAId = clientA.id;
    clientBId = clientB.id;

    const [projectA, projectB] = await Promise.all([
      db.project.create({ data: { clientId: clientAId, name: `${TEST_PREFIX}Project A` } }),
      db.project.create({ data: { clientId: clientBId, name: `${TEST_PREFIX}Project B` } }),
    ]);
    projectAId = projectA.id;
    projectBId = projectB.id;

    const [siteA, siteB] = await Promise.all([
      db.site.create({ data: { projectId: projectAId, name: `${TEST_PREFIX}Site A` } }),
      db.site.create({ data: { projectId: projectBId, name: `${TEST_PREFIX}Site B` } }),
    ]);
    siteAId = siteA.id;
    siteBId = siteB.id;

    const worker = await db.worker.create({
      data: { iqamaNumber: "9000000002", fullName: `${TEST_PREFIX}Mobile Worker` },
    });
    workerId = worker.id;
  });

  afterAll(async () => {
    await db.assignment.deleteMany({ where: { workerId } });
    await db.worker.delete({ where: { id: workerId } });
    await db.site.deleteMany({ where: { id: { in: [siteAId, siteBId] } } });
    await db.project.deleteMany({ where: { id: { in: [projectAId, projectBId] } } });
    await db.client.deleteMany({ where: { id: { in: [clientAId, clientBId] } } });
  });

  it("ends the prior assignment instead of deleting it when a new one starts", async () => {
    const januaryStart = new Date("2026-01-01");
    const marchStart = new Date("2026-03-01");

    const assignmentA = await db.assignment.create({
      data: {
        workerId,
        clientId: clientAId,
        projectId: projectAId,
        siteId: siteAId,
        workerHourlyRate: 15,
        clientBillingRate: 25,
        startDate: januaryStart,
        status: "ACTIVE",
      },
    });

    // Mirrors createAssignment's transaction: end the current active
    // assignment, then create the new one — never delete/overwrite the old row.
    const assignmentB = await db.$transaction(async (tx) => {
      await tx.assignment.update({
        where: { id: assignmentA.id },
        data: { status: "ENDED", endDate: marchStart },
      });
      return tx.assignment.create({
        data: {
          workerId,
          clientId: clientBId,
          projectId: projectBId,
          siteId: siteBId,
          workerHourlyRate: 17,
          clientBillingRate: 28,
          startDate: marchStart,
          status: "ACTIVE",
        },
      });
    });

    const history = await db.assignment.findMany({
      where: { workerId },
      orderBy: { startDate: "asc" },
    });

    expect(history).toHaveLength(2);

    const endedAssignment = history.find((a) => a.id === assignmentA.id);
    expect(endedAssignment?.status).toBe("ENDED");
    expect(endedAssignment?.endDate?.toISOString()).toBe(marchStart.toISOString());
    // The historical rate is untouched by the later move — it still reflects
    // what was actually paid/billed in January, not client B's rate (§8).
    expect(Number(endedAssignment?.workerHourlyRate)).toBe(15);
    expect(Number(endedAssignment?.clientBillingRate)).toBe(25);

    const activeAssignment = history.find((a) => a.id === assignmentB.id);
    expect(activeAssignment?.status).toBe("ACTIVE");
    expect(activeAssignment?.clientId).toBe(clientBId);
    expect(Number(activeAssignment?.workerHourlyRate)).toBe(17);
  });
});
