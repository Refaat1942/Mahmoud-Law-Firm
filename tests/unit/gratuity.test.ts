import { describe, expect, it } from "vitest";
import { calculateGratuity } from "../../src/lib/gratuity";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("calculateGratuity", () => {
  it("pays nothing before one year", () => {
    expect(calculateGratuity({ basicSalary: 10000, joinDate: d("2025-01-01"), endDate: d("2025-12-30") }).amount.toFixed(2)).toBe("0.00");
  });

  it("pays 21 days per year for the first five years", () => {
    // 3 years (1095 days): 10000/30 × 21 × 3 = 21000
    const r = calculateGratuity({ basicSalary: 10000, joinDate: d("2020-01-01"), endDate: d("2022-12-30") });
    expect(r.serviceDays).toBe(1095);
    expect(r.amount.toFixed(2)).toBe("21000.00");
  });

  it("pays 30 days per year after five years", () => {
    // exactly 7 × 365 = 2555 days (2016 and 2020 are leap years): 21×5 + 30×2 = 165 days of 1000 = 165000
    const r = calculateGratuity({ basicSalary: 30000, joinDate: d("2015-01-01"), endDate: d("2021-12-29") });
    expect(r.serviceDays).toBe(2555);
    expect(r.amount.toFixed(2)).toBe("165000.00");
  });

  it("excludes unpaid leave and caps at two years' basic wage", () => {
    const short = calculateGratuity({ basicSalary: 10000, joinDate: d("2024-01-01"), endDate: d("2025-01-10"), unpaidLeaveDays: 30 });
    expect(short.amount.toFixed(2)).toBe("0.00");
    const long = calculateGratuity({ basicSalary: 10000, joinDate: d("1990-01-01"), endDate: d("2025-12-31") });
    expect(long.capped).toBe(true);
    expect(long.amount.toFixed(2)).toBe("240000.00");
  });
});
