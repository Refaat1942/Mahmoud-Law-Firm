/** Converts Prisma results (Decimal, Date) into plain JSON-safe values for client components. */
export function plain<T>(value: T): Plain<T> {
  return JSON.parse(JSON.stringify(value));
}

export type Plain<T> = T extends Date
  ? string
  : T extends { toFixed: (n?: number) => string; toNumber: () => number }
    ? string
    : T extends (infer U)[]
      ? Plain<U>[]
      : T extends object
        ? { [K in keyof T]: Plain<T[K]> }
        : T;
