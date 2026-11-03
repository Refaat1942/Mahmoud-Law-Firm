import { dec, round2, type DecimalValue } from "./money";

const DAY_MS = 86_400_000;

/**
 * End-of-service gratuity under UAE Federal Decree-Law No. 33 of 2021:
 * nothing before one year of continuous service, 21 days' basic wage per year for the first five years,
 * 30 days' basic wage per year after that, pro-rated for partial years, capped at two years' basic wage.
 * Days of unpaid leave are excluded from service.
 */
export function calculateGratuity(input: {
  basicSalary: DecimalValue;
  joinDate: Date;
  endDate: Date;
  unpaidLeaveDays?: number;
}) {
  const totalDays = Math.floor((input.endDate.getTime() - input.joinDate.getTime()) / DAY_MS) + 1;
  const serviceDays = Math.max(0, totalDays - (input.unpaidLeaveDays ?? 0));
  const years = serviceDays / 365;
  const basic = dec(input.basicSalary);
  const dailyWage = basic.dividedBy(30);

  if (years < 1) return { serviceDays, years, dailyWage: round2(dailyWage), amount: dec(0), capped: false };

  const firstYears = Math.min(years, 5);
  const laterYears = Math.max(years - 5, 0);
  const raw = dailyWage.times(21).times(firstYears).plus(dailyWage.times(30).times(laterYears));
  const cap = basic.times(24);
  const capped = raw.greaterThan(cap);
  return { serviceDays, years, dailyWage: round2(dailyWage), amount: round2(capped ? cap : raw), capped };
}
