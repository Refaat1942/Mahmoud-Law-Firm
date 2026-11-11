import { z } from "zod";
import { zDate, zEnum, zId, zMoney, zOptDate, zOptId, zOptMoney, zOptText, zText } from "../common";

export const invoiceSchema = z.object({
  clientId: zId(),
  matterId: zOptId(),
  issueDate: zDate(),
  dueDate: zOptDate(),
  currency: zText(3),
  exchangeRate: zOptMoney(),
  notes: zOptText(),
});

export const quoteSchema = z.object({
  clientId: zId(),
  matterId: zOptId(),
  date: zDate(),
  validUntil: zOptDate(),
  currency: zText(3),
  notes: zOptText(),
});

export const lineSchema = z.object({
  type: zEnum(["TIME", "EXPENSE", "FEE", "OTHER"]),
  description: zText(1000),
  quantity: zMoney(),
  unitPrice: zMoney(),
  vatRate: zMoney(),
});

export const paymentSchema = z
  .object({
    clientId: zId(),
    invoiceId: zOptId(),
    date: zDate(),
    amount: zMoney(),
    method: zEnum(["CASH", "TRANSFER", "CHEQUE", "CARD"]),
    chequeNo: zOptText(40),
    chequeDueDate: zOptDate(),
    bankAccountId: zId(),
    reference: zOptText(100),
    notes: zOptText(),
    /** Split across several invoices of the client; when absent, invoiceId takes the whole amount. */
    allocations: z.array(z.object({ invoiceId: zId(), amount: zMoney() })).max(100).optional(),
  })
  .refine((p) => p.amount > 0, { message: "v.min0", path: ["amount"] })
  .refine((p) => p.method !== "CHEQUE" || !!p.chequeNo, { message: "v.required", path: ["chequeNo"] });

export const creditNoteSchema = z.object({
  reason: zText(500),
  amount: zMoney(),
  vatRate: zMoney(),
  date: zDate(),
});

export const trustSchema = z.object({
  clientId: zId(),
  matterId: zOptId(),
  date: zDate(),
  type: zEnum(["DEPOSIT", "WITHDRAWAL", "REFUND"]),
  amount: zMoney(),
  bankAccountId: zId(),
  notes: zOptText(),
});

export const applyTrustSchema = z.object({ amount: zMoney() });

export const allocateSchema = z.object({ allocations: z.array(z.object({ invoiceId: zId(), amount: zMoney() })).min(1).max(100) });
