import "server-only";
import { prisma } from "@/lib/prisma";
import { dec, sum } from "@/lib/money";

/** Normalises Arabic letter variants so "أحمد" matches "احمد". */
export function normalizeArabic(s: string) {
  return s
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\u064B-\u0652]/g, "")
    .trim();
}

function variants(q: string) {
  const n = normalizeArabic(q);
  const set = new Set([q.trim(), n]);
  if (n.includes("ا")) set.add(n.replace(/ا/g, "أ"));
  if (n.includes("ه")) set.add(n.replace(/ه$/g, "ة"));
  return [...set].filter((s) => s.length >= 2);
}

/** Searches clients and adverse parties (with the matters they appear in) for a name or ID number. */
export async function conflictCheck(q: string) {
  const terms = variants(q);
  if (!terms.length) return { clients: [], parties: [] };
  const or = terms.flatMap((t) => [
    { nameAr: { contains: t, mode: "insensitive" as const } },
    { nameEn: { contains: t, mode: "insensitive" as const } },
  ]);
  const [clients, parties] = await Promise.all([
    prisma.client.findMany({
      where: { deletedAt: null, OR: [...or, { emiratesId: { contains: q.trim() } }, { tradeLicenseNo: { contains: q.trim() } }, { passportNo: { contains: q.trim() } }] },
      include: { matters: { where: { deletedAt: null }, select: { id: true, fileNo: true, titleAr: true, titleEn: true, status: true } } },
      take: 50,
    }),
    prisma.party.findMany({
      where: { deletedAt: null, OR: [...or, { idNumber: { contains: q.trim() } }] },
      include: {
        matters: {
          where: { matter: { deletedAt: null } },
          include: { matter: { select: { id: true, fileNo: true, titleAr: true, titleEn: true, status: true, client: { select: { nameAr: true, nameEn: true } } } } },
        },
      },
      take: 50,
    }),
  ]);
  return { clients, parties };
}

/** Client statement: invoices as debits; payments, credit notes and trust applications as credits. */
export async function clientStatement(clientId: string) {
  const [invoices, payments, credits, trust] = await Promise.all([
    prisma.invoice.findMany({ where: { clientId, deletedAt: null, status: { notIn: ["DRAFT", "CANCELLED"] } } }),
    prisma.payment.findMany({ where: { clientId, deletedAt: null } }),
    prisma.creditNote.findMany({ where: { invoice: { clientId } }, include: { invoice: true } }),
    prisma.trustTransaction.findMany({ where: { clientId }, orderBy: { date: "asc" } }),
  ]);
  type Row = { id: string; date: Date; ref: string; kind: string; debit: string; credit: string };
  const rows: Row[] = [
    ...invoices.map((i) => ({ id: `i-${i.id}`, date: i.issueDate, ref: i.number, kind: "invoice", debit: i.total.toString(), credit: "0" })),
    ...payments.map((p) => ({ id: `p-${p.id}`, date: p.date, ref: p.number, kind: "payment", debit: "0", credit: p.amount.toString() })),
    ...credits.map((c) => ({ id: `c-${c.id}`, date: c.date, ref: c.number, kind: "creditNote", debit: "0", credit: c.total.toString() })),
    ...trust
      .filter((t) => t.type === "APPLIED")
      .map((t) => ({ id: `t-${t.id}`, date: t.date, ref: t.notes ?? "", kind: "trustApplied", debit: "0", credit: t.amount.toString() })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  let balance = dec(0);
  const withBalance = rows.map((r) => {
    balance = balance.plus(r.debit).minus(r.credit);
    return { ...r, date: r.date.toISOString(), balance: balance.toString() };
  });

  const trustBalance = sum(trust.map((t) => (t.type === "DEPOSIT" ? t.amount : t.amount.negated())));
  return { rows: withBalance, balance: balance.toString(), trustBalance: trustBalance.toString() };
}
