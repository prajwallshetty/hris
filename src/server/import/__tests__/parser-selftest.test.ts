import { describe, expect, it } from "vitest";

import { runImportParserSelfTest, SELFTEST_SERIALS } from "../parser-selftest";

describe("import parser self-test (what /api/health/import-parser runs in production)", () => {
  it("converts 46145, 46299 and 46240 in every cell shape, in the preview and in the saved value", () => {
    const result = runImportParserSelfTest();
    const failed = result.checks.filter((c) => !c.passed);
    expect(failed).toEqual([]);
    expect(result.passed).toBe(true);
    expect(result.checks).toHaveLength(5 * SELFTEST_SERIALS.length);
    expect(new Set(result.checks.map((c) => c.expected))).toEqual(new Set(["2026-05-03", "2026-10-04", "2026-08-06"]));
  });

  it("reports the library version it ran on", () => {
    expect(runImportParserSelfTest().engine.xlsx).toMatch(/^\d+\.\d+\.\d+/);
  });
});
