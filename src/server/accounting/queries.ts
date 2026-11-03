import "server-only";
import { prisma } from "@/lib/prisma";
import type { AccountTotals } from "@/lib/ledger";

/** Debit/credit totals per account for entries dated in [from, to); either bound may be omitted. */
export async function accountTotals(range: { from?: Date; to?: Date } = {}): Promise<AccountTotals[]> {
  const date = { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lt: range.to } : {}) };
  const [accounts, sums] = await Promise.all([
    prisma.account.findMany({ orderBy: { code: "asc" } }),
    prisma.journalLine.groupBy({
      by: ["accountId"],
      where: Object.keys(date).length ? { entry: { date } } : {},
      _sum: { debit: true, credit: true },
    }),
  ]);
  const byId = new Map(sums.map((s) => [s.accountId, s._sum]));
  return accounts.map((a) => ({
    id: a.id,
    code: a.code,
    nameAr: a.nameAr,
    nameEn: a.nameEn,
    type: a.type,
    debit: byId.get(a.id)?.debit ?? 0,
    credit: byId.get(a.id)?.credit ?? 0,
  }));
}

/** Parses ?from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive) into a half-open range, defaulting to the current year to date. */
export function reportRange(sp: { from?: string; to?: string }) {
  const now = new Date();
  const from = sp.from ? new Date(`${sp.from}T00:00:00`) : new Date(now.getFullYear(), 0, 1);
  const toInclusive = sp.to ? new Date(`${sp.to}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(toInclusive);
  to.setDate(to.getDate() + 1);
  return { from, to, toInclusive };
}
