"use server";

import { ActionError, defineAction } from "@/lib/action";
import { prisma, type Tx } from "@/lib/prisma";
import { nextNumber } from "@/lib/sequence";
import { ACC, UnbalancedEntryError, deleteEntriesFor, postEntry } from "@/lib/journal";
import { round2, type DecimalValue } from "@/lib/money";
import { accountSchema, bankAccountSchema, expenseSchema, journalSchema } from "./schema";

const SYSTEM_CODES = new Set<string>(Object.values(ACC));

// ───────────── Chart of accounts ─────────────

export const createAccount = defineAction({ module: "accounting", perm: "create", entity: "Account", schema: accountSchema }, async (input) => {
  if (input.parentId) {
    const parent = await prisma.account.findUniqueOrThrow({ where: { id: input.parentId } });
    if (parent.type !== input.type) throw new ActionError("accounting.parentType");
  }
  const a = await prisma.account.create({ data: input });
  return { id: a.id };
});

/** System accounts used by automatic postings keep their code and type. */
export const updateAccount = defineAction({ module: "accounting", perm: "update", entity: "Account", schema: accountSchema }, async (input, _c, id: string) => {
  const a = await prisma.account.findUniqueOrThrow({ where: { id } });
  if ((a.isSystem || SYSTEM_CODES.has(a.code)) && (input.code !== a.code || input.type !== a.type || !input.isActive)) throw new ActionError("accounting.systemAccount");
  if (input.parentId === id) throw new ActionError("accounting.parentSelf");
  await prisma.account.update({ where: { id }, data: { ...input, parentId: input.parentId ?? null } });
  return { id };
});

export const deleteAccount = defineAction({ module: "accounting", perm: "delete", entity: "Account" }, async (_i, _c, id: string) => {
  const a = await prisma.account.findUniqueOrThrow({ where: { id }, include: { _count: { select: { lines: true, children: true, expenses: true } }, bank: true } });
  if (a.isSystem || SYSTEM_CODES.has(a.code) || a.bank) throw new ActionError("accounting.systemAccount");
  if (a._count.lines || a._count.children || a._count.expenses) throw new ActionError("accounting.accountUsed");
  await prisma.account.delete({ where: { id } });
  return { id };
});

// ───────────── Manual journal entries ─────────────

export const createJournal = defineAction({ module: "accounting", perm: "create", entity: "JournalEntry", schema: journalSchema }, async (input, { user }) => {
  try {
    const e = await prisma.$transaction((tx) =>
      postEntry(tx, {
        date: input.date,
        description: input.description,
        sourceType: "manual",
        createdById: user.id,
        lines: input.lines.map((l) => ({ accountId: l.accountId, debit: l.debit ?? 0, credit: l.credit ?? 0, memo: l.memo })),
      }),
    );
    return { id: e.id };
  } catch (err) {
    if (err instanceof UnbalancedEntryError) throw new ActionError("accounting.unbalanced");
    throw err;
  }
});

/** Only manual entries can be deleted; automatic postings are reversed from their source document. */
export const deleteJournal = defineAction({ module: "accounting", perm: "delete", entity: "JournalEntry" }, async (_i, _c, id: string) => {
  const e = await prisma.journalEntry.findUniqueOrThrow({ where: { id } });
  if (e.sourceType !== "manual") throw new ActionError("accounting.autoEntry");
  if (await prisma.journalLine.count({ where: { entryId: id, reconciled: true } })) throw new ActionError("accounting.reconciled");
  await prisma.journalEntry.delete({ where: { id } });
  return { id, audit: e };
});

// ───────────── Expenses ─────────────

/** Posts Dr expense (net) + Dr input VAT, Cr the bank or cash account. */
type ExpenseRow = { id: string; number: string; date: Date; accountId: string; amount: DecimalValue; vatAmount: DecimalValue; bankAccountId: string; description: string };

async function postExpense(tx: Tx, e: ExpenseRow, userId: string) {
  const bank = await tx.bankAccount.findUniqueOrThrow({ where: { id: e.bankAccountId } });
  const net = round2(e.amount);
  const vat = round2(e.vatAmount);
  await postEntry(tx, {
    date: e.date,
    description: `${e.number} — ${e.description}`,
    sourceType: "expense",
    sourceId: e.id,
    createdById: userId,
    lines: [
      { accountId: e.accountId, debit: net },
      { accountCode: ACC.VAT_INPUT, debit: vat },
      { accountId: bank.accountId, credit: net.plus(vat) },
    ],
  });
}

async function checkExpense(input: { accountId: string; matterId?: string; clientId?: string; billable: boolean }) {
  const account = await prisma.account.findUniqueOrThrow({ where: { id: input.accountId } });
  if (account.type !== "EXPENSE" && account.type !== "ASSET") throw new ActionError("accounting.expenseAccount");
  let clientId = input.clientId;
  if (input.matterId) clientId = (await prisma.matter.findUniqueOrThrow({ where: { id: input.matterId }, select: { clientId: true } })).clientId;
  if (input.billable && !clientId) throw new ActionError("accounting.billableNeedsClient");
  return clientId;
}

export const createExpense = defineAction({ module: "accounting", perm: "create", entity: "Expense", schema: expenseSchema }, async (input, { user }) => {
  const clientId = await checkExpense(input);
  const e = await prisma.$transaction(async (tx) => {
    const number = await nextNumber("expense", tx);
    const created = await tx.expense.create({ data: { ...input, clientId, vatAmount: input.vatAmount ?? 0, number } });
    await postExpense(tx, created, user.id);
    return created;
  });
  return { id: e.id };
});

export const updateExpense = defineAction({ module: "accounting", perm: "update", entity: "Expense", schema: expenseSchema }, async (input, { user }, id: string) => {
  const prev = await prisma.expense.findFirstOrThrow({ where: { id, deletedAt: null } });
  if (prev.invoiceId) throw new ActionError("accounting.expenseInvoiced");
  const clientId = await checkExpense(input);
  await prisma.$transaction(async (tx) => {
    const e = await tx.expense.update({ where: { id }, data: { ...input, clientId: clientId ?? null, matterId: input.matterId ?? null, vatAmount: input.vatAmount ?? 0 } });
    await deleteEntriesFor(tx, "expense", id);
    await postExpense(tx, e, user.id);
  });
  return { id };
});

export const deleteExpense = defineAction({ module: "accounting", perm: "delete", entity: "Expense" }, async (_i, _c, id: string) => {
  const e = await prisma.expense.findFirstOrThrow({ where: { id, deletedAt: null } });
  if (e.invoiceId) throw new ActionError("accounting.expenseInvoiced");
  await prisma.$transaction(async (tx) => {
    await tx.expense.update({ where: { id }, data: { deletedAt: new Date() } });
    await deleteEntriesFor(tx, "expense", id);
  });
  return { id };
});

// ───────────── Bank and cash accounts ─────────────

/** Creates the ledger account (under 1100 Cash and banks) together with the bank record. */
export const createBankAccount = defineAction({ module: "accounting", perm: "create", entity: "BankAccount", schema: bankAccountSchema }, async ({ code, ...input }) => {
  const parent = await prisma.account.findUnique({ where: { code: "1100" } });
  const b = await prisma.$transaction(async (tx) => {
    const account = await tx.account.create({ data: { code, nameAr: input.nameAr, nameEn: input.nameEn, type: "ASSET", parentId: parent?.id } });
    return tx.bankAccount.create({ data: { ...input, accountId: account.id } });
  });
  return { id: b.id };
});

export const updateBankAccount = defineAction({ module: "accounting", perm: "update", entity: "BankAccount", schema: bankAccountSchema }, async (input, _c, id: string) => {
  const b = await prisma.bankAccount.findUniqueOrThrow({ where: { id } });
  // The ledger code is fixed once the account exists.
  const { nameAr, nameEn, type, bankName, iban, currency } = input;
  await prisma.$transaction([
    prisma.bankAccount.update({ where: { id }, data: { nameAr, nameEn, type, bankName, iban, currency } }),
    prisma.account.update({ where: { id: b.accountId }, data: { nameAr, nameEn } }),
  ]);
  return { id };
});

export const toggleBankAccount = defineAction({ module: "accounting", perm: "update", entity: "BankAccount" }, async (_i, _c, id: string) => {
  const b = await prisma.bankAccount.findUniqueOrThrow({ where: { id } });
  await prisma.bankAccount.update({ where: { id }, data: { isActive: !b.isActive } });
  return { id, audit: { isActive: !b.isActive } };
});

/** Marks ledger lines of a bank account as matched to the bank statement (or unmarks them). */
export const toggleReconciled = defineAction({ module: "accounting", perm: "update", entity: "JournalLine" }, async (_i, _c, lineId: string) => {
  const l = await prisma.journalLine.findUniqueOrThrow({ where: { id: lineId } });
  await prisma.journalLine.update({ where: { id: lineId }, data: { reconciled: !l.reconciled, reconciledAt: l.reconciled ? null : new Date() } });
  return { id: lineId };
});
