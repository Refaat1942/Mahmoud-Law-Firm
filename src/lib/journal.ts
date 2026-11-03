import { dec, round2, sum, type DecimalValue } from "./money";
import { nextNumber } from "./sequence";
import type { Tx } from "./prisma";

/** System chart-of-accounts codes used by automatic postings. */
export const ACC = {
  CASH: "1110",
  BANK: "1120",
  RECEIVABLE: "1200",
  VAT_INPUT: "1300",
  TRUST_LIABILITY: "2100",
  VAT_OUTPUT: "2200",
  SALARIES_PAYABLE: "2300",
  CAPITAL: "3000",
  RETAINED: "3100",
  FEES_REVENUE: "4000",
  REIMBURSED_REVENUE: "4100",
  SALARIES_EXPENSE: "5100",
} as const;

export type EntryLine = { accountCode?: string; accountId?: string; debit?: DecimalValue; credit?: DecimalValue; memo?: string };

export class UnbalancedEntryError extends Error {}

/** Drops zero lines and verifies debits equal credits. */
export function normalizeLines(lines: EntryLine[]) {
  const clean = lines
    .map((l) => ({ ...l, debit: round2(l.debit ?? 0), credit: round2(l.credit ?? 0) }))
    .filter((l) => !l.debit.isZero() || !l.credit.isZero());
  const debit = sum(clean.map((l) => l.debit));
  const credit = sum(clean.map((l) => l.credit));
  if (!debit.equals(credit) || clean.length < 2) throw new UnbalancedEntryError(`Unbalanced entry: ${debit} != ${credit}`);
  return { lines: clean, total: debit };
}

export async function postEntry(
  tx: Tx,
  entry: { date: Date; description: string; sourceType?: string; sourceId?: string; createdById?: string; lines: EntryLine[] },
) {
  const { lines } = normalizeLines(entry.lines);
  const codes = [...new Set(lines.filter((l) => !l.accountId).map((l) => l.accountCode!))];
  const accounts = await tx.account.findMany({ where: { code: { in: codes } } });
  const byCode = new Map(accounts.map((a) => [a.code, a.id]));
  const number = await nextNumber("journal", tx);
  return tx.journalEntry.create({
    data: {
      number,
      date: entry.date,
      description: entry.description,
      sourceType: entry.sourceType,
      sourceId: entry.sourceId,
      createdById: entry.createdById,
      lines: {
        create: lines.map((l) => {
          const accountId = l.accountId ?? byCode.get(l.accountCode!);
          if (!accountId) throw new Error(`Missing account ${l.accountCode}`);
          return { accountId, debit: l.debit, credit: l.credit, memo: l.memo };
        }),
      },
    },
  });
}

/** Removes automatic postings for a source document (used before re-posting or on cancellation). */
export async function deleteEntriesFor(tx: Tx, sourceType: string, sourceId: string) {
  await tx.journalEntry.deleteMany({ where: { sourceType, sourceId } });
}

export function invoiceLines(inv: { subtotal: DecimalValue; vatAmount: DecimalValue; total: DecimalValue; reimbursed?: DecimalValue }): EntryLine[] {
  const reimbursed = dec(inv.reimbursed ?? 0);
  return [
    { accountCode: ACC.RECEIVABLE, debit: inv.total },
    { accountCode: ACC.FEES_REVENUE, credit: dec(inv.subtotal).minus(reimbursed) },
    { accountCode: ACC.REIMBURSED_REVENUE, credit: reimbursed },
    { accountCode: ACC.VAT_OUTPUT, credit: inv.vatAmount },
  ];
}
