import { dec, round2, type DecimalValue } from "./money";

export const AGING_BUCKETS = ["current", "d30", "d60", "d90", "over90"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

const DAY_MS = 86_400_000;

/** Bucket by days past the due date (or issue date when there is none): not due, 1–30, 31–60, 61–90, over 90. */
export function agingBucket(due: Date, asOf: Date): AgingBucket {
  const days = Math.floor((Date.UTC(asOf.getFullYear(), asOf.getMonth(), asOf.getDate()) - Date.UTC(due.getFullYear(), due.getMonth(), due.getDate())) / DAY_MS);
  if (days <= 0) return "current";
  if (days <= 30) return "d30";
  if (days <= 60) return "d60";
  if (days <= 90) return "d90";
  return "over90";
}

/** Receivables per client split into aging buckets. */
export function agingReport<T extends { clientId: string; due: Date; balance: DecimalValue }>(rows: T[], asOf: Date) {
  const byClient = new Map<string, Record<AgingBucket | "total", ReturnType<typeof dec>>>();
  const zero = () => Object.fromEntries([...AGING_BUCKETS, "total"].map((k) => [k, dec(0)])) as Record<AgingBucket | "total", ReturnType<typeof dec>>;
  const totals = zero();
  for (const r of rows) {
    const b = dec(r.balance);
    if (!b.greaterThan(0)) continue;
    const bucket = agingBucket(r.due, asOf);
    const c = byClient.get(r.clientId) ?? zero();
    c[bucket] = round2(c[bucket].plus(b));
    c.total = round2(c.total.plus(b));
    totals[bucket] = round2(totals[bucket].plus(b));
    totals.total = round2(totals.total.plus(b));
    byClient.set(r.clientId, c);
  }
  return { byClient, totals };
}
