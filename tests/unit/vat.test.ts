import { describe, expect, it } from "vitest";
import { computeLine, computeTotals, splitInclusive } from "../../src/lib/vat";

describe("computeLine", () => {
  it("rounds VAT per line", () => {
    const l = computeLine({ quantity: 3, unitPrice: "33.33", vatRate: 5 });
    expect(l.amount.toFixed(2)).toBe("99.99");
    expect(l.vatAmount.toFixed(2)).toBe("5.00");
    expect(l.total.toFixed(2)).toBe("104.99");
  });

  it("supports zero-rated lines", () => {
    expect(computeLine({ quantity: 1, unitPrice: 500, vatRate: 0 }).vatAmount.toFixed(2)).toBe("0.00");
  });
});

describe("computeTotals", () => {
  it("sums rounded lines", () => {
    const t = computeTotals([
      { quantity: 1, unitPrice: "10.10", vatRate: 5 },
      { quantity: 1, unitPrice: "10.10", vatRate: 5 },
    ]);
    // 0.505 → 0.51 on each line, so 1.02 rather than 1.01 on the total
    expect(t.vatAmount.toFixed(2)).toBe("1.02");
    expect(t.subtotal.toFixed(2)).toBe("20.20");
    expect(t.total.toFixed(2)).toBe("21.22");
  });
});

describe("splitInclusive", () => {
  it("splits a VAT-inclusive amount", () => {
    const s = splitInclusive(105, 5);
    expect(s.net.toFixed(2)).toBe("100.00");
    expect(s.vatAmount.toFixed(2)).toBe("5.00");
  });
});
