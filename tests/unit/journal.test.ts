import { describe, expect, it } from "vitest";
import { ACC, UnbalancedEntryError, invoiceLines, normalizeLines } from "../../src/lib/journal";

describe("normalizeLines", () => {
  it("drops zero lines and returns the total", () => {
    const r = normalizeLines([
      { accountCode: "1", debit: 100 },
      { accountCode: "2", credit: 100 },
      { accountCode: "3", debit: 0, credit: 0 },
    ]);
    expect(r.lines).toHaveLength(2);
    expect(r.total.toFixed(2)).toBe("100.00");
  });

  it("rejects unbalanced or single-line entries", () => {
    expect(() => normalizeLines([{ accountCode: "1", debit: 100 }, { accountCode: "2", credit: 99.99 }])).toThrow(UnbalancedEntryError);
    expect(() => normalizeLines([{ accountCode: "1", debit: 0 }])).toThrow(UnbalancedEntryError);
  });
});

describe("invoiceLines", () => {
  it("splits fees, recharged expenses and output VAT", () => {
    const lines = invoiceLines({ subtotal: 1000, vatAmount: 50, total: 1050, reimbursed: 200 });
    const { lines: clean } = normalizeLines(lines);
    const byCode = Object.fromEntries(clean.map((l) => [l.accountCode, l]));
    expect(byCode[ACC.RECEIVABLE].debit.toFixed(2)).toBe("1050.00");
    expect(byCode[ACC.FEES_REVENUE].credit.toFixed(2)).toBe("800.00");
    expect(byCode[ACC.REIMBURSED_REVENUE].credit.toFixed(2)).toBe("200.00");
    expect(byCode[ACC.VAT_OUTPUT].credit.toFixed(2)).toBe("50.00");
  });
});
