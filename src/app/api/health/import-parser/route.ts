import { NextResponse } from "next/server";

import { runImportParserSelfTest } from "@/server/import/parser-selftest";
import { assertCan } from "@/server/rbac";
import { getSessionUser } from "@/server/session";

// Signed-in admins only (/api routes sit outside proxy.ts, so this checks its
// own auth). Open it on the deployed site to see which build and SheetJS
// version are live and whether the worker-import date pipeline converts the
// reported Excel serials (46145, 46299, 46240) correctly in every cell shape.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    assertCan(await getSessionUser(), "create", "worker");
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = runImportParserSelfTest();
  return NextResponse.json(result, { status: result.passed ? 200 : 500 });
}
