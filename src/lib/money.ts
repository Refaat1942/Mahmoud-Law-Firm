import { Prisma } from "@prisma/client";

export const Decimal = Prisma.Decimal;
export type DecimalValue = Prisma.Decimal | number | string;

export const dec = (v: DecimalValue | null | undefined) => new Decimal(v ?? 0);

/** Rounds half away from zero to 2 decimals (fils). */
export const round2 = (v: DecimalValue) => dec(v).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

export const sum = (values: DecimalValue[]) => values.reduce<Prisma.Decimal>((acc, v) => acc.plus(dec(v)), dec(0));
