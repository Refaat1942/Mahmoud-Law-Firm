import { dec, round2, sum, type DecimalValue } from "./money";

export const UAE_STANDARD_VAT = 5;

export type LineInput = { quantity: DecimalValue; unitPrice: DecimalValue; vatRate: DecimalValue };

/** VAT is computed and rounded per line, as allowed by the UAE FTA. */
export function computeLine(line: LineInput) {
  const amount = round2(dec(line.quantity).times(dec(line.unitPrice)));
  const vatAmount = round2(amount.times(dec(line.vatRate)).dividedBy(100));
  return { amount, vatAmount, total: amount.plus(vatAmount) };
}

export function computeTotals(lines: LineInput[]) {
  const computed = lines.map(computeLine);
  const subtotal = sum(computed.map((c) => c.amount));
  const vatAmount = sum(computed.map((c) => c.vatAmount));
  return { lines: computed, subtotal, vatAmount, total: subtotal.plus(vatAmount) };
}

/** Splits a VAT-inclusive amount into net and VAT. */
export function splitInclusive(gross: DecimalValue, vatRate: DecimalValue) {
  const g = dec(gross);
  const net = round2(g.times(100).dividedBy(dec(100).plus(dec(vatRate))));
  return { net, vatAmount: g.minus(net) };
}
