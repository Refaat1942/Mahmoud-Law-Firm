import { prisma, type Tx } from "./prisma";

export const SEQUENCE_DEFAULTS: Record<string, { prefix: string; padding: number; yearly: boolean }> = {
  client: { prefix: "CL", padding: 4, yearly: false },
  matter: { prefix: "M", padding: 4, yearly: true },
  invoice: { prefix: "INV", padding: 5, yearly: true },
  quote: { prefix: "QT", padding: 4, yearly: true },
  payment: { prefix: "RV", padding: 5, yearly: true },
  creditNote: { prefix: "CN", padding: 4, yearly: true },
  expense: { prefix: "EX", padding: 5, yearly: true },
  journal: { prefix: "JV", padding: 5, yearly: true },
  employee: { prefix: "EMP", padding: 3, yearly: false },
};

export function formatNumber(prefix: string, n: number, padding: number, year: number | null) {
  const num = String(n).padStart(padding, "0");
  return year ? `${prefix}-${year}-${num}` : `${prefix}-${num}`;
}

/** Atomically reserves the next number for a sequence (resets yearly when configured). */
export async function nextNumber(key: string, tx: Tx = prisma): Promise<string> {
  const d = SEQUENCE_DEFAULTS[key] ?? { prefix: key.toUpperCase(), padding: 4, yearly: false };
  const year = new Date().getFullYear();
  await tx.sequence.upsert({
    where: { key },
    create: { key, prefix: d.prefix, padding: d.padding, yearly: d.yearly, next: 1, year },
    update: {},
  });
  const rows = await tx.$queryRaw<{ prefix: string; next: number; padding: number; yearly: boolean }[]>`
    UPDATE "Sequence"
    SET "next" = CASE WHEN "yearly" AND "year" IS DISTINCT FROM ${year} THEN 2 ELSE "next" + 1 END,
        "year" = ${year}
    WHERE "key" = ${key}
    RETURNING "prefix", "next", "padding", "yearly"`;
  const r = rows[0];
  return formatNumber(r.prefix, r.next - 1, r.padding, r.yearly ? year : null);
}
