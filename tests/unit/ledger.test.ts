import { describe, expect, it } from "vitest";
import { balanceSheet, naturalBalance, profitAndLoss, runningBalance, trialBalance, vatReturn, type AccountTotals } from "../../src/lib/ledger";

const acc = (code: string, type: AccountTotals["type"], debit: number, credit: number): AccountTotals => ({ id: code, code, nameAr: code, nameEn: code, type, debit, credit });

// Invoice 1050 (1000 + 50 VAT), 600 collected, rent 300 + 15 input VAT paid from bank, capital 5000.
const accounts = [
  acc("1120", "ASSET", 5000 + 600, 315),
  acc("1200", "ASSET", 1050, 600),
  acc("1300", "ASSET", 15, 0),
  acc("2200", "LIABILITY", 0, 50),
  acc("3000", "EQUITY", 0, 5000),
  acc("4000", "REVENUE", 0, 1000),
  acc("5200", "EXPENSE", 300, 0),
];

describe("naturalBalance", () => {
  it("is positive in the account's normal direction", () => {
    expect(naturalBalance(acc("x", "ASSET", 100, 30)).toFixed(2)).toBe("70.00");
    expect(naturalBalance(acc("x", "LIABILITY", 30, 100)).toFixed(2)).toBe("70.00");
  });
});

describe("trialBalance", () => {
  it("balances and places nets on one side", () => {
    const tb = trialBalance(accounts);
    expect(tb.balanced).toBe(true);
    expect(tb.debit.toFixed(2)).toBe("6050.00");
    expect(tb.rows.find((r) => r.code === "2200")!.credit.toFixed(2)).toBe("50.00");
  });
});

describe("profitAndLoss", () => {
  it("nets revenue against expenses", () => {
    const pl = profitAndLoss(accounts);
    expect(pl.totalRevenue.toFixed(2)).toBe("1000.00");
    expect(pl.totalExpenses.toFixed(2)).toBe("300.00");
    expect(pl.net.toFixed(2)).toBe("700.00");
  });
});

describe("balanceSheet", () => {
  it("includes current earnings in equity and balances", () => {
    const bs = balanceSheet(accounts);
    expect(bs.totalAssets.toFixed(2)).toBe("5750.00");
    expect(bs.totalLiabilities.toFixed(2)).toBe("50.00");
    expect(bs.totalEquity.toFixed(2)).toBe("5700.00");
    expect(bs.balanced).toBe(true);
  });
});

describe("vatReturn", () => {
  it("computes the net VAT payable", () => {
    const v = vatReturn({ outputVat: { debit: 5, credit: 50 }, inputVat: { debit: 15, credit: 0 }, standardRatedSales: 900, expenses: 300 });
    expect(v.outputVat.toFixed(2)).toBe("45.00");
    expect(v.inputVat.toFixed(2)).toBe("15.00");
    expect(v.netPayable.toFixed(2)).toBe("30.00");
  });
});

describe("runningBalance", () => {
  it("accumulates from the opening balance", () => {
    const rows = runningBalance("ASSET", 100, [
      { debit: 50, credit: 0 },
      { debit: 0, credit: 120 },
    ]);
    expect(rows.map((r) => r.balance.toFixed(2))).toEqual(["150.00", "30.00"]);
  });
});
