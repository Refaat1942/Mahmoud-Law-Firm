import { z } from "zod";
import { zBool, zDate, zEnum, zId, zMoney, zOptId, zOptMoney, zOptText, zText } from "../common";

export const accountSchema = z.object({
  code: z.string().trim().regex(/^\d{3,8}$/, "v.accountCode"),
  nameAr: zText(),
  nameEn: zText(),
  type: zEnum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]),
  parentId: zOptId(),
  isActive: zBool(),
});

export const expenseSchema = z.object({
  date: zDate(),
  accountId: zId(),
  description: zText(500),
  vendor: zOptText(200),
  amount: zMoney(),
  vatAmount: zOptMoney(),
  matterId: zOptId(),
  clientId: zOptId(),
  billable: zBool(),
  bankAccountId: zId(),
});

export const bankAccountSchema = z.object({
  nameAr: zText(),
  nameEn: zText(),
  type: zEnum(["BANK", "CASH"]),
  bankName: zOptText(100),
  iban: z.preprocess((v) => (v === "" ? undefined : String(v).replace(/\s/g, "").toUpperCase()), z.string().regex(/^AE\d{21}$/, "v.iban").optional()),
  currency: zText(3),
  code: z.string().trim().regex(/^\d{3,8}$/, "v.accountCode"),
});

export const journalSchema = z.object({
  date: zDate(),
  description: zText(500),
  lines: z
    .array(z.object({ accountId: zId(), debit: zOptMoney(), credit: zOptMoney(), memo: zOptText(200) }))
    .min(2, "v.journalLines"),
});
