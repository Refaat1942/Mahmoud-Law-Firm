/** UAE federal working week: Monday to Friday (Saturday and Sunday are the weekend). */
export const WEEKEND_DAYS = [0, 6];

export const isoDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export function isWorkingDay(d: Date, holidays: Set<string>) {
  return !WEEKEND_DAYS.includes(d.getDay()) && !holidays.has(isoDate(d));
}

/** Adds calendar days; if the last day falls on a weekend or public holiday it moves to the next working day. */
export function computeDueDate(start: Date, days: number, holidays: Set<string> = new Set()) {
  const due = new Date(start);
  due.setHours(0, 0, 0, 0);
  due.setDate(due.getDate() + days);
  while (!isWorkingDay(due, holidays)) due.setDate(due.getDate() + 1);
  return due;
}

export function daysUntil(date: Date, from = new Date()) {
  const a = new Date(from);
  a.setHours(0, 0, 0, 0);
  const b = new Date(date);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
