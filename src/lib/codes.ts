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

export function parseWorkerCodeSearch(term: string): number | null {
  const match = term.trim().match(/^w?-?0*(\d+)$/i);
  return match ? Number(match[1]) : null;
}
