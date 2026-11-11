import { dec, round2, sum, type DecimalValue } from "./money";

export type InvoiceStatus = "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";

/** Amount still owed on an invoice after payments (including applied trust funds) and credit notes. */
export function balanceDue(inv: { total: DecimalValue; paidAmount: DecimalValue; creditAmount: DecimalValue }) {
  return round2(dec(inv.total).minus(dec(inv.paidAmount)).minus(dec(inv.creditAmount)));
}

/** Status of an issued invoice from what has been settled; drafts and cancelled invoices keep their status. */
export function settledStatus(inv: { status: InvoiceStatus; total: DecimalValue; paidAmount: DecimalValue; creditAmount: DecimalValue }): InvoiceStatus {
  if (inv.status === "DRAFT" || inv.status === "CANCELLED") return inv.status;
  const due = balanceDue(inv);
  if (due.lessThanOrEqualTo(0)) return "PAID";
  const settled = dec(inv.paidAmount).plus(dec(inv.creditAmount));
  return settled.greaterThan(0) ? "PARTIALLY_PAID" : "ISSUED";
}

export type TrustMovement = { type: "DEPOSIT" | "WITHDRAWAL" | "APPLIED" | "REFUND"; amount: DecimalValue };

/** Client funds held in trust: deposits minus withdrawals, refunds and amounts applied to invoices. */
export function trustBalance(movements: TrustMovement[]) {
  return round2(sum(movements.map((m) => (m.type === "DEPOSIT" ? dec(m.amount) : dec(m.amount).negated()))));
}

/** Converts an amount in the invoice currency to AED for the ledger. */
export const toAed = (amount: DecimalValue, exchangeRate: DecimalValue) => round2(dec(amount).times(dec(exchangeRate)));

/** Splits a credit note's net amount into net, VAT and total. */
export function creditNoteTotals(net: DecimalValue, vatRate: DecimalValue) {
  const subtotal = round2(net);
  const vatAmount = round2(subtotal.times(dec(vatRate)).dividedBy(100));
  return { subtotal, vatAmount, total: subtotal.plus(vatAmount) };
}

export type AllocationInput = { invoiceId: string; amount: DecimalValue };
export type OpenInvoice = { id: string; due: DecimalValue };

/**
 * Checks how a receipt is split across invoices: positive amounts, each within that invoice's balance,
 * no invoice twice, and the total not above the receipt. Returns an error key or null.
 */
export function validateAllocations(amount: DecimalValue, allocations: AllocationInput[], open: OpenInvoice[]): string | null {
  const seen = new Set<string>();
  const dues = new Map(open.map((o) => [o.id, round2(o.due)]));
  let total = dec(0);
  for (const a of allocations) {
    const v = round2(a.amount);
    if (!v.greaterThan(0)) return "billing.allocationPositive";
    if (seen.has(a.invoiceId)) return "billing.allocationDuplicate";
    seen.add(a.invoiceId);
    const due = dues.get(a.invoiceId);
    if (!due) return "billing.notPayable";
    if (v.greaterThan(due)) return "billing.overpayment";
    total = total.plus(v);
  }
  if (total.greaterThan(round2(amount))) return "billing.allocationExceeds";
  return null;
}

/** Oldest-first split of an amount over open invoices (the order given). */
export function autoAllocate(amount: DecimalValue, open: OpenInvoice[]): AllocationInput[] {
  let left = round2(amount);
  const out: AllocationInput[] = [];
  for (const o of open) {
    if (!left.greaterThan(0)) break;
    const due = round2(o.due);
    if (!due.greaterThan(0)) continue;
    const take = due.lessThan(left) ? due : left;
    out.push({ invoiceId: o.id, amount: take });
    left = left.minus(take);
  }
  return out;
}
