import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma, type Tx } from "@/lib/prisma";
import { matterScope, type CurrentUser } from "@/lib/session";
import { balanceDue, settledStatus, trustBalance } from "@/lib/billing";
import { computeTotals } from "@/lib/vat";
import { dec, sum } from "@/lib/money";

/** Roles limited to assigned matters see invoices on those matters plus client-level invoices. */
export function invoiceScope(user: CurrentUser): Prisma.InvoiceWhereInput {
  if (user.scopeAll) return { deletedAt: null };
  return { deletedAt: null, OR: [{ matterId: null }, { matter: matterScope(user) }] };
}

export function quoteScope(user: CurrentUser): Prisma.QuoteWhereInput {
  if (user.scopeAll) return { deletedAt: null };
  return { deletedAt: null, OR: [{ matterId: null }, { matter: matterScope(user) }] };
}

/**
 * Payments a user may see: everything for roles that see every matter; otherwise only payments
 * allocated to at least one invoice inside their invoice scope (unallocated "on account" payments stay hidden).
 */
export function paymentScope(user: CurrentUser): Prisma.PaymentWhereInput {
  if (user.scopeAll) return { deletedAt: null };
  return { deletedAt: null, allocations: { some: { invoice: invoiceScope(user) } } };
}

/** Trust movements a user may see: all for scope-all roles, otherwise those on their matters. */
export function trustScope(user: CurrentUser): Prisma.TrustTransactionWhereInput {
  if (user.scopeAll) return {};
  return { matter: { is: matterScope(user) } };
}

/**
 * Payments that count towards an invoice: not deleted and not a bounced cheque.
 * chequeStatus is NULL for non-cheque payments, and `NOT (x = 'BOUNCED')` is NULL in SQL, so the null case is explicit.
 */
export const COUNTED_PAYMENT: Prisma.PaymentWhereInput = { deletedAt: null, OR: [{ chequeStatus: null }, { chequeStatus: { not: "BOUNCED" } }] };

/** Recomputes line totals (drafts only), settled amounts and status of one invoice. */
export async function recalcInvoice(tx: Tx, id: string) {
  const inv = await tx.invoice.findUniqueOrThrow({ where: { id }, include: { lines: true } });
  let totals = { subtotal: inv.subtotal, vatAmount: inv.vatAmount, total: inv.total };
  if (inv.status === "DRAFT") {
    const t = computeTotals(inv.lines);
    totals = { subtotal: t.subtotal, vatAmount: t.vatAmount, total: t.total };
  }
  const [payments, applied, credits] = await Promise.all([
    tx.paymentAllocation.findMany({ where: { invoiceId: id, payment: COUNTED_PAYMENT }, select: { amount: true } }),
    tx.trustTransaction.findMany({ where: { invoiceId: id, type: "APPLIED" }, select: { amount: true } }),
    tx.creditNote.findMany({ where: { invoiceId: id }, select: { total: true } }),
  ]);
  const paidAmount = sum([...payments.map((p) => p.amount), ...applied.map((a) => a.amount)]);
  const creditAmount = sum(credits.map((c) => c.total));
  const status = settledStatus({ status: inv.status, total: totals.total, paidAmount, creditAmount });
  return tx.invoice.update({ where: { id }, data: { ...totals, paidAmount, creditAmount, status } });
}

export async function recalcQuote(tx: Tx, id: string) {
  const lines = await tx.quoteLine.findMany({ where: { quoteId: id } });
  const t = computeTotals(lines);
  return tx.quote.update({ where: { id }, data: { subtotal: t.subtotal, vatAmount: t.vatAmount, total: t.total } });
}

export async function clientTrustBalance(clientId: string, tx: Tx = prisma) {
  const rows = await tx.trustTransaction.findMany({ where: { clientId }, select: { type: true, amount: true } });
  return trustBalance(rows);
}

/** Approved billable time, recharged expenses and due instalments not yet on any invoice. */
export async function unbilledItems(clientId: string, matterId: string | null) {
  const where = matterId ? { matterId } : { matter: { clientId } };
  const [time, expenses, installments] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { ...where, deletedAt: null, billable: true, status: "APPROVED", invoiceId: null },
      include: { user: true },
      orderBy: { date: "asc" },
    }),
    prisma.expense.findMany({
      where: { deletedAt: null, billable: true, invoiceId: null, ...(matterId ? { matterId } : { clientId }) },
      orderBy: { date: "asc" },
    }),
    prisma.feeInstallment.findMany({
      where: { invoiceId: null, agreement: matterId ? { matterId } : { matter: { clientId } } },
      include: { agreement: { include: { matter: true } } },
      orderBy: { dueDate: "asc" },
    }),
  ]);
  const minutes = time.reduce((a, e) => a + e.minutes, 0);
  return { time, expenses, installments, hours: minutes / 60, expenseTotal: sum(expenses.map((e) => e.amount)), installmentTotal: sum(installments.map((i) => i.amount)) };
}

export const hasValue = (v: Prisma.Decimal) => dec(v).greaterThan(0);

/** Part of a receipt not yet allocated to invoices (held on the client's account). */
export async function unallocated(paymentId: string, tx: Tx = prisma) {
  const p = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { allocations: true } });
  return dec(p.amount).minus(sum(p.allocations.map((a) => a.amount)));
}

/** Issued invoices of a client still open, oldest first, with their balance (within the user's scope). */
export async function openInvoices(user: CurrentUser, clientId: string, tx: Tx = prisma) {
  const rows = await tx.invoice.findMany({
    where: { AND: [invoiceScope(user), { clientId, status: { in: ["ISSUED", "PARTIALLY_PAID"] } }] },
    orderBy: [{ issueDate: "asc" }, { number: "asc" }],
  });
  return rows.map((i) => ({ ...i, due: balanceDue(i) }));
}
