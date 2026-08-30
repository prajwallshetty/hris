import type { NextRequest } from "next/server";

import { formatWorkerCode } from "@/lib/codes";
import { toCsv } from "@/lib/csv";
import type { WorkerStatus } from "@prisma/client";
import { listWorkersForExport } from "@/server/queries/workers";
import { getSessionUser } from "@/server/session";

function formatDate(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

// Note: /api routes are outside proxy.ts's matcher (it excludes "/api"),
// so this handler enforces its own auth/RBAC via getSessionUser +
// listWorkersForExport's assertCan — never assume the proxy already gated it.
export async function GET(request: NextRequest) {
  let user;
  try {
    user = await getSessionUser();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("q") ?? undefined;
  const status = (searchParams.get("status") as WorkerStatus | "ALL" | null) ?? "ALL";

  const workers = await listWorkersForExport(user, { search, status });

  const csv = toCsv(
    [
      "Worker ID",
      "Iqama Number",
      "Full Name",
      "Designation",
      "Client",
      "Site",
      "Coordinator",
      "Hourly Rate",
      "Status",
      "Joining Date",
      "Mobilization Date",
      "Demobilization Date",
    ],
    workers.map((w) => {
      const assignment = w.assignments[0];
      return [
        formatWorkerCode(w.sequenceNo),
        w.iqamaNumber,
        w.fullName,
        w.designation?.title ?? "",
        assignment?.client.companyName ?? "",
        assignment?.site.name ?? "",
        w.coordinator?.name ?? "",
        w.hourlyRate ? Number(w.hourlyRate).toFixed(2) : "",
        w.status,
        formatDate(w.joiningDate),
        formatDate(w.mobilizationDate),
        formatDate(w.demobilizationDate),
      ];
    }),
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="workers-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
