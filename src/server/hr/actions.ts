"use server";

import { getTranslations } from "next-intl/server";
import { ActionError, defineAction } from "@/lib/action";
import { prisma } from "@/lib/prisma";
import { nextNumber } from "@/lib/sequence";
import { ACC, deleteEntriesFor, postEntry } from "@/lib/journal";
import { sum } from "@/lib/money";
import { daysInclusive, overlapDays, payslip, periodBounds } from "@/lib/payroll";
import { attendanceSchema, employeeDocSchema, employeeSchema, leaveSchema, payPayrollSchema, payrollLineSchema, payrollSchema } from "./schema";

const normalizeIban = (v?: string) => (v ? v.replace(/\s/g, "").toUpperCase() : v);

// ───────────── Employees ─────────────

export const createEmployee = defineAction({ module: "hr", perm: "create", entity: "Employee", schema: employeeSchema }, async (input) => {
  const e = await prisma.employee.create({ data: { ...input, iban: normalizeIban(input.iban), code: await nextNumber("employee") } });
  return { id: e.id };
});

export const updateEmployee = defineAction({ module: "hr", perm: "update", entity: "Employee", schema: employeeSchema }, async (input, _c, id: string) => {
  await prisma.employee.update({ where: { id }, data: { ...input, userId: input.userId ?? null, iban: normalizeIban(input.iban) } });
  return { id };
});

export const deleteEmployee = defineAction({ module: "hr", perm: "delete", entity: "Employee" }, async (_i, _c, id: string) => {
  if (await prisma.payrollLine.count({ where: { employeeId: id } })) throw new ActionError("hr.hasPayroll");
  await prisma.employee.update({ where: { id }, data: { deletedAt: new Date(), userId: null } });
  return { id };
});

export const addEmployeeDoc = defineAction({ module: "hr", perm: "update", entity: "EmployeeDocument", schema: employeeDocSchema }, async (input, _c, employeeId: string) => {
  const d = await prisma.employeeDocument.create({ data: { ...input, employeeId } });
  return { id: d.id };
});

export const deleteEmployeeDoc = defineAction({ module: "hr", perm: "update", entity: "EmployeeDocument" }, async (_i, _c, id: string) => {
  await prisma.employeeDocument.delete({ where: { id } });
  return { id };
});

// ───────────── Attendance ─────────────

const atTime = (date: Date, hhmm?: string) => {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) throw new ActionError("hr.timeFormat");
  const d = new Date(date);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
};

/** One record per employee per day; saving again updates it. */
export const saveAttendance = defineAction({ module: "hr", perm: "create", entity: "Attendance", schema: attendanceSchema }, async (input) => {
  const data = { status: input.status, notes: input.notes, checkIn: atTime(input.date, input.checkIn), checkOut: atTime(input.date, input.checkOut) };
  const a = await prisma.attendance.upsert({
    where: { employeeId_date: { employeeId: input.employeeId, date: input.date } },
    create: { employeeId: input.employeeId, date: input.date, ...data },
    update: data,
  });
  return { id: a.id };
});

export const deleteAttendance = defineAction({ module: "hr", perm: "delete", entity: "Attendance" }, async (_i, _c, id: string) => {
  await prisma.attendance.delete({ where: { id } });
  return { id };
});

// ───────────── Leave ─────────────

export const requestLeave = defineAction({ module: "hr", perm: "create", entity: "LeaveRequest", schema: leaveSchema }, async (input) => {
  const overlap = await prisma.leaveRequest.count({
    where: { employeeId: input.employeeId, status: { not: "REJECTED" }, fromDate: { lte: input.toDate }, toDate: { gte: input.fromDate } },
  });
  if (overlap) throw new ActionError("hr.leaveOverlap");
  const l = await prisma.leaveRequest.create({ data: { ...input, days: daysInclusive(input.fromDate, input.toDate) } });
  return { id: l.id };
});

export const reviewLeave = defineAction({ module: "hr", perm: "approve", entity: "LeaveRequest" }, async (input, { user }, id: string) => {
  const status = (input as { status?: string }).status;
  if (status !== "APPROVED" && status !== "REJECTED") throw new ActionError("errors.validation");
  const l = await prisma.leaveRequest.findUniqueOrThrow({ where: { id } });
  if (l.status !== "PENDING") throw new ActionError("hr.leaveReviewed");
  await prisma.leaveRequest.update({ where: { id }, data: { status, approvedById: user.id } });
  return { id, audit: { status } };
});

export const deleteLeave = defineAction({ module: "hr", perm: "delete", entity: "LeaveRequest" }, async (_i, _c, id: string) => {
  const l = await prisma.leaveRequest.findUniqueOrThrow({ where: { id } });
  if (l.status === "APPROVED") throw new ActionError("hr.leaveApproved");
  await prisma.leaveRequest.delete({ where: { id } });
  return { id };
});

// ───────────── Payroll ─────────────

/** Approved leave days inside the period, split into unpaid days and all leave days (for the WPS file). */
async function leaveInPeriod(employeeId: string, period: string) {
  const { start, end } = periodBounds(period);
  const leaves = await prisma.leaveRequest.findMany({ where: { employeeId, status: "APPROVED", fromDate: { lte: end }, toDate: { gte: start } } });
  const days = (rows: typeof leaves) => rows.reduce((a, l) => a + overlapDays(l.fromDate, l.toDate, period), 0);
  return { unpaid: days(leaves.filter((l) => l.type === "UNPAID")), all: days(leaves) };
}

/** Creates a draft payroll with a line for every employee in service during the period. */
export const createPayroll = defineAction({ module: "hr", perm: "create", entity: "Payroll", schema: payrollSchema }, async ({ period }) => {
  if (await prisma.payroll.findUnique({ where: { period } })) throw new ActionError("hr.payrollExists");
  const { start, end } = periodBounds(period);
  const employees = await prisma.employee.findMany({
    where: { deletedAt: null, joinDate: { lte: end }, OR: [{ endDate: null }, { endDate: { gte: start } }], status: { not: "TERMINATED" } },
    orderBy: { code: "asc" },
  });
  if (!employees.length) throw new ActionError("hr.noEmployees");
  const lines = [];
  for (const e of employees) {
    const leave = await leaveInPeriod(e.id, period);
    const p = payslip(e, { unpaidDays: leave.unpaid });
    lines.push({ employeeId: e.id, basic: p.basic, allowances: p.allowances, deductions: p.unpaidDeduction, additions: 0, net: p.net, leaveDays: leave.all, workDays: 30 - leave.unpaid });
  }
  const payroll = await prisma.payroll.create({ data: { period, total: sum(lines.map((l) => l.net)), lines: { create: lines } } });
  return { id: payroll.id };
});

/** Edits additions and deductions on a draft line; deductions here are the line's total deductions. */
export const updatePayrollLine = defineAction({ module: "hr", perm: "update", entity: "PayrollLine", schema: payrollLineSchema }, async (input, _c, lineId: string) => {
  const line = await prisma.payrollLine.findUniqueOrThrow({ where: { id: lineId }, include: { payroll: true } });
  if (line.payroll.status !== "DRAFT") throw new ActionError("hr.payrollLocked");
  const gross = line.basic.plus(line.allowances);
  const p = payslip({ basicSalary: line.basic, housingAllowance: line.allowances, transportAllowance: 0, otherAllowance: 0 }, { additions: input.additions ?? 0, deductions: input.deductions ?? 0 });
  await prisma.$transaction(async (tx) => {
    await tx.payrollLine.update({ where: { id: lineId }, data: { additions: p.additions, deductions: p.deductions, net: p.net, leaveDays: input.leaveDays, notes: input.notes } });
    const all = await tx.payrollLine.findMany({ where: { payrollId: line.payrollId }, select: { net: true } });
    await tx.payroll.update({ where: { id: line.payrollId }, data: { total: sum(all.map((l) => l.net)) } });
  });
  return { id: lineId, audit: { ...input, gross: gross.toString() } };
});

/** Approving accrues the salary cost: Dr salaries expense, Cr salaries payable. */
export const approvePayroll = defineAction({ module: "hr", perm: "approve", entity: "Payroll" }, async (_i, { user }, id: string) => {
  const pr = await prisma.payroll.findUniqueOrThrow({ where: { id } });
  if (pr.status !== "DRAFT") throw new ActionError("hr.payrollLocked");
  const t = await getTranslations("hr");
  await prisma.$transaction(async (tx) => {
    if (!pr.total.isZero())
      await postEntry(tx, {
        date: periodBounds(pr.period).end,
        description: t("journal.accrual", { period: pr.period }),
        sourceType: "payroll",
        sourceId: id,
        createdById: user.id,
        lines: [
          { accountCode: ACC.SALARIES_EXPENSE, debit: pr.total },
          { accountCode: ACC.SALARIES_PAYABLE, credit: pr.total },
        ],
      });
    await tx.payroll.update({ where: { id }, data: { status: "APPROVED" } });
  });
  return { id };
});

/** Back to draft before payment; removes the accrual. */
export const reopenPayroll = defineAction({ module: "hr", perm: "approve", entity: "Payroll" }, async (_i, _c, id: string) => {
  const pr = await prisma.payroll.findUniqueOrThrow({ where: { id } });
  if (pr.status !== "APPROVED") throw new ActionError("hr.payrollLocked");
  await prisma.$transaction(async (tx) => {
    await deleteEntriesFor(tx, "payroll", id);
    await tx.payroll.update({ where: { id }, data: { status: "DRAFT" } });
  });
  return { id };
});

/** Paying settles the payable from the chosen bank account. */
export const payPayroll = defineAction({ module: "hr", perm: "approve", entity: "Payroll", schema: payPayrollSchema }, async (input, { user }, id: string) => {
  const pr = await prisma.payroll.findUniqueOrThrow({ where: { id } });
  if (pr.status !== "APPROVED") throw new ActionError("hr.payrollNotApproved");
  const bank = await prisma.bankAccount.findUniqueOrThrow({ where: { id: input.bankAccountId } });
  const t = await getTranslations("hr");
  await prisma.$transaction(async (tx) => {
    if (!pr.total.isZero())
      await postEntry(tx, {
        date: input.date,
        description: t("journal.payment", { period: pr.period }),
        sourceType: "payroll",
        sourceId: id,
        createdById: user.id,
        lines: [
          { accountCode: ACC.SALARIES_PAYABLE, debit: pr.total },
          { accountId: bank.accountId, credit: pr.total },
        ],
      });
    await tx.payroll.update({ where: { id }, data: { status: "PAID", paidAt: input.date, bankAccountId: bank.id } });
  });
  return { id };
});

export const deletePayroll = defineAction({ module: "hr", perm: "delete", entity: "Payroll" }, async (_i, _c, id: string) => {
  const pr = await prisma.payroll.findUniqueOrThrow({ where: { id } });
  if (pr.status !== "DRAFT") throw new ActionError("hr.payrollLocked");
  await prisma.payroll.delete({ where: { id } });
  return { id };
});
