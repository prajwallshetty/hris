import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

// Worker.designation is normalized into a Designation lookup table, but
// forms keep a plain free-text field rather than forcing a pre-populated
// dropdown — find-or-create by title keeps the data normalized without
// requiring a separate Designation management screen first.
export async function resolveDesignationId(
  title: string | null | undefined,
  client: Prisma.TransactionClient = db,
): Promise<string | null> {
  const trimmed = title?.trim();
  if (!trimmed) return null;
  const designation = await client.designation.upsert({
    where: { title: trimmed },
    update: {},
    create: { title: trimmed },
  });
  return designation.id;
}
