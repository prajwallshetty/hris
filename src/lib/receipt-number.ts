import { db } from "@/lib/db";

/**
 * Generates a unique, professional receipt number in the format `RCP-YYYY-XXXXX`.
 * Uses database payment counts to assign sequential numbers per calendar year.
 */
export async function generateUniqueReceiptNumber(year?: number): Promise<string> {
  const targetYear = year ?? new Date().getFullYear();
  const prefix = `RCP-${targetYear}-`;

  // Find the latest receipt number matching this year's prefix
  const latestPayment = await db.workerPayment.findFirst({
    where: {
      receiptNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      receiptNumber: true,
    },
  });

  let nextSeq = 1;
  if (latestPayment?.receiptNumber) {
    const parts = latestPayment.receiptNumber.split("-");
    const numPart = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(numPart)) {
      nextSeq = numPart + 1;
    }
  }

  // Ensure collision safety by attempting format and appending sequence if needed
  let receiptNumber = `${prefix}${String(nextSeq).padStart(5, "0")}`;
  let exists = await db.workerPayment.findUnique({ where: { receiptNumber } });
  
  while (exists) {
    nextSeq += 1;
    receiptNumber = `${prefix}${String(nextSeq).padStart(5, "0")}`;
    exists = await db.workerPayment.findUnique({ where: { receiptNumber } });
  }

  return receiptNumber;
}
