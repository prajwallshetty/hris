// Human-readable IDs derived from a DB sequence rather than stored
// separately (avoids a duplicated calculated value — see §31 note in
// schema.prisma). Parsing is intentionally forgiving so users can type
// "42", "W-42", or "W-000042" interchangeably when searching.

export function formatWorkerCode(sequenceNo: number): string {
  return `W-${String(sequenceNo).padStart(6, "0")}`;
}

export function formatEmployeeCode(sequenceNo: number): string {
  return `E-${String(sequenceNo).padStart(6, "0")}`;
}

export function formatInvoiceNumber(sequenceNo: number): string {
  return `INV-${String(sequenceNo).padStart(6, "0")}`;
}

export function formatVehicleCode(sequenceNo: number): string {
  return `VEH-${String(sequenceNo).padStart(5, "0")}`;
}

export function formatEquipmentCode(sequenceNo: number): string {
  return `EQP-${String(sequenceNo).padStart(5, "0")}`;
}

export function formatRentalCode(sequenceNo: number): string {
  return `RNT-${String(sequenceNo).padStart(5, "0")}`;
}

export function formatReceiptNumber(sequenceNo: number): string {
  return `RCP-${String(sequenceNo).padStart(6, "0")}`;
}

// Postgres `Int` (sequenceNo and similar) columns are 32-bit. Matching a
// search term against one without bounds-checking crashes the query for
// any numeric-looking input longer than ~10 digits — a pasted Iqama
// number, phone number, or serial — throwing
// `PrismaClientKnownRequestError: value out of range for type integer`
// and taking down the entire list page. Every "does this search term look
// like a record number" parser in the app must go through this bound.
const INT32_MAX = 2147483647;
const INT32_MIN = -2147483648;

export function toSafeSequenceNo(value: number): number | null {
  return Number.isInteger(value) && value >= INT32_MIN && value <= INT32_MAX ? value : null;
}

export function parseWorkerCodeSearch(term: string): number | null {
  const match = term.trim().match(/^w?-?0*(\d+)$/i);
  return match ? toSafeSequenceNo(Number(match[1])) : null;
}
