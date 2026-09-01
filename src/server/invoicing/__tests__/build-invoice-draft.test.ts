import { describe, expect, it } from "vitest";

import { buildInvoiceDraft } from "../build-invoice-draft";

describe("buildInvoiceDraft", () => {
  it("bills hours at the client rate, independent of any worker rate", () => {
    const draft = buildInvoiceDraft(
      [{ workerId: "w1", siteId: "s1", description: "Worker A — Site A", clientBillingRate: "25", hours: "200" }],
      "0",
    );

    expect(draft.items).toHaveLength(1);
    expect(draft.items[0].amount).toBe("5000.00");
    expect(draft.subtotal).toBe("5000.00");
    expect(draft.totalAmount).toBe("5000.00");
  });

  it("applies the configured tax percentage on top of the subtotal", () => {
    const draft = buildInvoiceDraft(
      [{ workerId: "w1", siteId: "s1", description: "Worker A — Site A", clientBillingRate: "25", hours: "200" }],
      "15",
    );

    expect(draft.subtotal).toBe("5000.00");
    expect(draft.taxAmount).toBe("750.00");
    expect(draft.totalAmount).toBe("5750.00");
  });

  it("sums hours for the same worker/site into a single line item", () => {
    const draft = buildInvoiceDraft(
      [
        { workerId: "w1", siteId: "s1", description: "Worker A — Site A", clientBillingRate: "25", hours: "100" },
        { workerId: "w1", siteId: "s1", description: "Worker A — Site A", clientBillingRate: "25", hours: "80" },
      ],
      "0",
    );

    expect(draft.items).toHaveLength(1);
    expect(draft.items[0].hours).toBe("180.00");
    expect(draft.items[0].amount).toBe("4500.00");
  });

  it("keeps different workers/sites as separate line items", () => {
    const draft = buildInvoiceDraft(
      [
        { workerId: "w1", siteId: "s1", description: "Worker A — Site A", clientBillingRate: "25", hours: "100" },
        { workerId: "w2", siteId: "s1", description: "Worker B — Site A", clientBillingRate: "30", hours: "100" },
      ],
      "0",
    );

    expect(draft.items).toHaveLength(2);
    expect(draft.subtotal).toBe("5500.00");
  });
});
