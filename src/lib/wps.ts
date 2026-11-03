import { dec, round2, sum, type DecimalValue } from "./money";

export type WpsEmployee = {
  molPersonId: string;
  bankRoutingCode: string;
  iban: string;
  fixed: DecimalValue;
  variable: DecimalValue;
  leaveDays: number;
};

const pad2 = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/**
 * Builds a WPS Salary Information File (SIF): one EDR line per employee followed by the SCR control line.
 * `period` is "YYYY-MM".
 */
export function buildSif(input: {
  employerId: string;
  bankCode: string;
  period: string;
  employees: WpsEmployee[];
  createdAt?: Date;
}) {
  const [year, month] = input.period.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  const days = end.getDate();
  const now = input.createdAt ?? new Date();

  const edr = input.employees.map((e) =>
    [
      "EDR",
      e.molPersonId.padStart(14, "0"),
      e.bankRoutingCode,
      e.iban,
      ymd(start),
      ymd(end),
      days,
      round2(e.fixed).toFixed(2),
      round2(e.variable).toFixed(2),
      e.leaveDays,
    ].join(","),
  );

  const total = sum(input.employees.map((e) => dec(e.fixed).plus(dec(e.variable))));
  const scr = [
    "SCR",
    input.employerId.padStart(13, "0"),
    input.bankCode,
    ymd(now),
    `${pad2(now.getHours())}${pad2(now.getMinutes())}`,
    `${pad2(month)}${year}`,
    input.employees.length,
    round2(total).toFixed(2),
    "AED",
    "",
  ].join(",");

  const fileName = `${input.employerId.padStart(13, "0")}${String(now.getFullYear()).slice(2)}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}.SIF`;
  return { content: [...edr, scr].join("\r\n") + "\r\n", fileName, total: round2(total) };
}
