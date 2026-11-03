import { describe, expect, it } from "vitest";
import { balanceDue, creditNoteTotals, settledStatus, toAed, trustBalance } from "../../src/lib/billing";

describe("balanceDue", () => {
  it("subtracts payments and credit notes", () => {
    expect(balanceDue({ total: "1050.00", paidAmount: 500, creditAmount: "105.00" }).toFixed(2)).toBe("445.00");
  });
});

describe("settledStatus", () => {
  const inv = { status: "ISSUED" as const, total: 1050 };
  it("tracks partial and full settlement", () => {
    expect(settledStatus({ ...inv, paidAmount: 0, creditAmount: 0 })).toBe("ISSUED");
    expect(settledStatus({ ...inv, paidAmount: 100, creditAmount: 0 })).toBe("PARTIALLY_PAID");
    expect(settledStatus({ ...inv, paidAmount: 945, creditAmount: 105 })).toBe("PAID");
    expect(settledStatus({ status: "PAID", total: 1050, paidAmount: 0, creditAmount: 0 })).toBe("ISSUED");
  });

  it("leaves drafts and cancelled invoices alone", () => {
    expect(settledStatus({ status: "DRAFT", total: 10, paidAmount: 10, creditAmount: 0 })).toBe("DRAFT");
    expect(settledStatus({ status: "CANCELLED", total: 10, paidAmount: 0, creditAmount: 0 })).toBe("CANCELLED");
  });
});

describe("trustBalance", () => {
  it("nets deposits against withdrawals, refunds and applications", () => {
    const b = trustBalance([
      { type: "DEPOSIT", amount: 10000 },
      { type: "APPLIED", amount: "2500.50" },
      { type: "WITHDRAWAL", amount: 1000 },
      { type: "REFUND", amount: 500 },
    ]);
    expect(b.toFixed(2)).toBe("5999.50");
  });
});

describe("toAed / creditNoteTotals", () => {
  it("converts at the invoice rate", () => {
    expect(toAed(100, "3.6725").toFixed(2)).toBe("367.25");
  });
  it("adds VAT to the credited net amount", () => {
    const c = creditNoteTotals("200", 5);
    expect([c.subtotal, c.vatAmount, c.total].map((v) => v.toFixed(2))).toEqual(["200.00", "10.00", "210.00"]);
  });
});
