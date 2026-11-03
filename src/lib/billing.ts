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
