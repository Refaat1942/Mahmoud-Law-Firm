import { z } from "zod";
import { zDate, zEnum, zId, zInt, zMoney, zOptDate, zOptId, zOptMoney, zOptText, zText } from "../common";

export const employeeSchema = z.object({
  nameAr: zText(),
  nameEn: zText(),
  userId: zOptId(),
  position: zOptText(100),
  department: zOptText(100),
  nationality: zOptText(60),
  joinDate: zDate(),
  endDate: zOptDate(),
  contractType: zEnum(["UNLIMITED", "LIMITED"]),
  status: zEnum(["ACTIVE", "ON_LEAVE", "TERMINATED"]),
  emiratesId: zOptText(20),
  passportNo: zOptText(30),
  laborCardNo: zOptText(30),
  molPersonId: zOptText(14),
  bankRoutingCode: zOptText(9),
  iban: zOptText(34),
  basicSalary: zMoney(),
  housingAllowance: zOptMoney(),
  transportAllowance: zOptMoney(),
  otherAllowance: zOptMoney(),
  annualLeaveDays: zInt(0),
});

export const employeeDocSchema = z.object({
  type: zEnum(["EMIRATES_ID", "RESIDENCE", "PASSPORT", "LABOR_CARD", "BAR_LICENSE", "OTHER"]),
  number: zText(60),
  issueDate: zOptDate(),
  expiryDate: zOptDate(),
});

export const attendanceSchema = z.object({
  employeeId: zId(),
  date: zDate(),
  checkIn: zOptText(5),
  checkOut: zOptText(5),
  status: zEnum(["PRESENT", "ABSENT", "LATE", "LEAVE", "REMOTE"]),
  notes: zOptText(300),
});

export const leaveSchema = z
  .object({
    employeeId: zId(),
    type: zEnum(["ANNUAL", "SICK", "UNPAID", "MATERNITY", "PARENTAL", "OTHER"]),
    fromDate: zDate(),
    toDate: zDate(),
    reason: zOptText(),
  })
  .refine((l) => l.toDate >= l.fromDate, { message: "v.dateOrder", path: ["toDate"] });

export const payrollSchema = z.object({ period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "v.period") });

export const payrollLineSchema = z.object({ additions: zOptMoney(), deductions: zOptMoney(), leaveDays: zInt(0), notes: zOptText(300) });

export const payPayrollSchema = z.object({ bankAccountId: zId(), date: zDate() });

export const gratuitySchema = z.object({ endDate: zDate(), unpaidLeaveDays: zInt(0) });

export const employeeLinkSchema = z.object({ employeeId: zOptId() });
