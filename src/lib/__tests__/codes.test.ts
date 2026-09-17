import { describe, expect, it } from "vitest";

import { parseWorkerCodeSearch, toSafeSequenceNo } from "../codes";

describe("toSafeSequenceNo", () => {
  it("accepts values within Postgres Int (32-bit) range", () => {
    expect(toSafeSequenceNo(42)).toBe(42);
    expect(toSafeSequenceNo(2147483647)).toBe(2147483647);
  });

  it("rejects values outside Postgres Int range — the exact overflow that crashed Workers search", () => {
    // A 10-digit Iqama number typed into search (e.g. "5654159159") parses
    // as a valid JS number well past Postgres Int32 max, and previously
    // crashed the entire Workers page with
    // `PrismaClientKnownRequestError: value out of range for type integer`.
    expect(toSafeSequenceNo(5654159159)).toBeNull();
    expect(toSafeSequenceNo(2147483648)).toBeNull();
    expect(toSafeSequenceNo(-2147483649)).toBeNull();
  });

  it("rejects non-integers", () => {
    expect(toSafeSequenceNo(NaN)).toBeNull();
    expect(toSafeSequenceNo(1.5)).toBeNull();
  });
});

describe("parseWorkerCodeSearch", () => {
  it("matches worker codes in W-000042 / 42 / w42 forms", () => {
    expect(parseWorkerCodeSearch("W-000042")).toBe(42);
    expect(parseWorkerCodeSearch("42")).toBe(42);
    expect(parseWorkerCodeSearch("w42")).toBe(42);
  });

  it("never returns an out-of-range sequence number for a bare Iqama-length search", () => {
    expect(parseWorkerCodeSearch("5654159159")).toBeNull();
  });

  it("returns null for non-numeric search terms", () => {
    expect(parseWorkerCodeSearch("Mohammed")).toBeNull();
  });
});
