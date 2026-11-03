import { describe, expect, it } from "vitest";
import { annualLeaveEntitlement, daysInclusive, overlapDays, payslip } from "../../src/lib/payroll";

describe("days", () => {
  it("counts inclusive calendar days and overlaps with a month", () => {
    expect(daysInclusive(new Date(2026, 0, 30), new Date(2026, 1, 2))).toBe(4);
    expect(overlapDays(new Date(2026, 0, 30), new Date(2026, 1, 2), "2026-02")).toBe(2);
    expect(overlapDays(new Date(2026, 2, 1), new Date(2026, 2, 5), "2026-02")).toBe(0);
  });
});

describe("payslip", () => {
  const salary = { basicSalary: 10000, housingAllowance: 4000, transportAllowance: 1000, otherAllowance: 0 };
  it("adds allowances and additions, subtracts deductions", () => {
    const p = payslip(salary, { additions: 500, deductions: 250 });
    expect(p.gross.toFixed(2)).toBe("15000.00");
    expect(p.net.toFixed(2)).toBe("15250.00");
    expect(p.fixed.toFixed(2)).toBe("14750.00");
    expect(p.variable.toFixed(2)).toBe("500.00");
  });
  it("deducts unpaid leave at gross / 30 per day", () => {
    const p = payslip(salary, { unpaidDays: 3 });
    expect(p.unpaidDeduction.toFixed(2)).toBe("1500.00");
    expect(p.net.toFixed(2)).toBe("13500.00");
  });
  it("never pays a negative fixed component", () => {
    expect(payslip(salary, { deductions: 20000 }).net.toFixed(2)).toBe("0.00");
  });
});

describe("annualLeaveEntitlement", () => {
  it("gives nothing in the first six months", () => {
    expect(annualLeaveEntitlement({ joinDate: new Date(2026, 3, 1), annualDays: 30, year: 2026, asOf: new Date(2026, 8, 15) })).toBe(0);
  });
  it("gives two days per month between six months and a year", () => {
    expect(annualLeaveEntitlement({ joinDate: new Date(2026, 0, 1), annualDays: 30, year: 2026, asOf: new Date(2026, 7, 1) })).toBe(14);
  });
  it("pro-rates the annual entitlement after the first year", () => {
    expect(annualLeaveEntitlement({ joinDate: new Date(2020, 5, 1), annualDays: 30, year: 2026 })).toBe(30);
    expect(annualLeaveEntitlement({ joinDate: new Date(2020, 5, 1), annualDays: 30, year: 2026, asOf: new Date(2026, 5, 30) })).toBe(15);
  });
});
