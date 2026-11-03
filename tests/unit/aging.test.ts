import { describe, expect, it } from "vitest";
import { agingBucket, agingReport } from "../../src/lib/aging";

const asOf = new Date(2026, 5, 30);
const d = (m: number, day: number) => new Date(2026, m, day);

describe("agingBucket", () => {
  it("buckets by days past due", () => {
    expect(agingBucket(d(5, 30), asOf)).toBe("current");
    expect(agingBucket(d(6, 15), asOf)).toBe("current");
    expect(agingBucket(d(5, 29), asOf)).toBe("d30");
    expect(agingBucket(d(4, 31), asOf)).toBe("d30");
    expect(agingBucket(d(4, 30), asOf)).toBe("d60");
    expect(agingBucket(d(3, 1), asOf)).toBe("d90");
    expect(agingBucket(d(0, 1), asOf)).toBe("over90");
  });
});

describe("agingReport", () => {
  it("sums balances per client and bucket, ignoring settled invoices", () => {
    const r = agingReport(
      [
        { clientId: "a", due: d(5, 20), balance: "100.50" },
        { clientId: "a", due: d(0, 1), balance: 400 },
        { clientId: "b", due: d(6, 10), balance: 50 },
        { clientId: "b", due: d(0, 1), balance: 0 },
      ],
      asOf,
    );
    expect(r.byClient.get("a")!.total.toFixed(2)).toBe("500.50");
    expect(r.byClient.get("a")!.over90.toFixed(2)).toBe("400.00");
    expect(r.byClient.get("b")!.current.toFixed(2)).toBe("50.00");
    expect(r.totals.total.toFixed(2)).toBe("550.50");
  });
});
