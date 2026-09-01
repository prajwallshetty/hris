import { describe, expect, it } from "vitest";

import { buildWorkerPayrollDraft } from "../build-worker-payroll";

describe("buildWorkerPayrollDraft", () => {
  it("computes regular and overtime pay for a single-assignment worker", () => {
    const draft = buildWorkerPayrollDraft(
      [{ siteLabel: "Acme / Main Site", workerHourlyRate: "15", regularHours: "180", overtimeHours: "20" }],
      "1.5",
    );

    expect(draft.regularHours).toBe("180.00");
    expect(draft.overtimeHours).toBe("20.00");
    expect(draft.regularRate).toBe("15.00");
    expect(draft.overtimeRate).toBe("22.50");
    expect(draft.items).toHaveLength(2);
    expect(draft.items[0]).toMatchObject({ type: "REGULAR_HOURS", amount: "2700.00" });
    expect(draft.items[1]).toMatchObject({ type: "OVERTIME", amount: "450.00" });
  });

  it("produces a weighted-average rate across multiple assignments/sites", () => {
    const draft = buildWorkerPayrollDraft(
      [
        { siteLabel: "Acme / Site A", workerHourlyRate: "10", regularHours: "100", overtimeHours: "0" },
        { siteLabel: "Beta / Site B", workerHourlyRate: "20", regularHours: "100", overtimeHours: "0" },
      ],
      "1.5",
    );

    expect(draft.regularHours).toBe("200.00");
    // (100*10 + 100*20) / 200 = 15
    expect(draft.regularRate).toBe("15.00");
    expect(draft.items).toHaveLength(2);
  });

  it("omits zero-hour item rows and returns zeros for an empty input", () => {
    const draft = buildWorkerPayrollDraft([], "1.5");
    expect(draft.items).toHaveLength(0);
    expect(draft.regularHours).toBe("0.00");
    expect(draft.overtimeRate).toBe("0.00");
  });
});
