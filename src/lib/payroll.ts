import { dec, round2, type DecimalValue } from "./money";

const DAY_MS = 86_400_000;
const utcDay = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());

/** Calendar days from `from` to `to`, both inclusive. */
export const daysInclusive = (from: Date, to: Date) => Math.max(0, Math.round((utcDay(to) - utcDay(from)) / DAY_MS) + 1);

/** First and last day of a "YYYY-MM" period. */
export function periodBounds(period: string) {
  const [y, m] = period.split("-").map(Number);
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0) };
}

/** Days of [from, to] that fall inside the period. */
export function overlapDays(from: Date, to: Date, period: string) {
  const { start, end } = periodBounds(period);
  const a = from > start ? from : start;
  const b = to < end ? to : end;
  return b < a ? 0 : daysInclusive(a, b);
}

export type SalaryParts = { basicSalary: DecimalValue; housingAllowance: DecimalValue; transportAllowance: DecimalValue; otherAllowance: DecimalValue };

/** Monthly fixed pay: basic plus allowances. */
export const allowancesOf = (e: SalaryParts) => round2(dec(e.housingAllowance).plus(dec(e.transportAllowance)).plus(dec(e.otherAllowance)));

/**
 * Net pay for one month. Unpaid leave is deducted at (basic + allowances) / 30 per day.
 * WPS splits the result into a fixed part (pay after deductions) and a variable part (additions).
 */
export function payslip(e: SalaryParts, input: { additions?: DecimalValue; deductions?: DecimalValue; unpaidDays?: number }) {
  const basic = round2(e.basicSalary);
  const allowances = allowancesOf(e);
  const gross = basic.plus(allowances);
  const unpaidDeduction = round2(gross.dividedBy(30).times(input.unpaidDays ?? 0));
  const additions = round2(input.additions ?? 0);
  const deductions = round2(input.deductions ?? 0);
  const fixed = gross.minus(deductions).minus(unpaidDeduction);
  const fixedPaid = fixed.isNegative() ? dec(0) : fixed;
  return { basic, allowances, gross, unpaidDeduction, additions, deductions, fixed: fixedPaid, variable: additions, net: fixedPaid.plus(additions) };
}

/**
 * Annual leave entitlement for a calendar year under the UAE Labour Law: none in the first six months of
 * service, two days per month of service between six months and one year, then the full annual entitlement
 * pro-rated for the months of the year the employee was in service.
 */
export function annualLeaveEntitlement(input: { joinDate: Date; annualDays: number; year: number; asOf?: Date }) {
  const asOf = input.asOf ?? new Date(input.year, 11, 31);
  const yearStart = new Date(input.year, 0, 1);
  const monthsBetween = (a: Date, b: Date) => (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + (b.getDate() >= a.getDate() ? 0 : -1);
  const serviceMonths = monthsBetween(input.joinDate, asOf);
  if (serviceMonths < 6) return 0;
  if (serviceMonths < 12) return Math.min(serviceMonths, 12) * 2;
  const from = input.joinDate > yearStart ? input.joinDate : yearStart;
  const monthsThisYear = Math.min(12, Math.max(0, monthsBetween(from, asOf) + 1));
  return Math.round((input.annualDays * monthsThisYear) / 12 * 10) / 10;
}
