import { dec, round2, type DecimalValue } from "./money";

/** Converts decimal hours (e.g. 1.25) to whole minutes. */
export const hoursToMinutes = (hours: number) => Math.round(hours * 60);

/** Billable value of a time entry: rate × minutes / 60, rounded to fils. */
export const timeAmount = (rate: DecimalValue, minutes: number) => round2(dec(rate).times(minutes).dividedBy(60));

export type RateSources = {
  /** Hourly rate from the case fee agreement, when the agreement type is HOURLY. */
  agreement?: DecimalValue | null;
  /** Rate agreed for this lawyer with this client. */
  userClient?: DecimalValue | null;
  /** Rate for this client, any lawyer. */
  client?: DecimalValue | null;
  /** Standard rate for this lawyer. */
  user?: DecimalValue | null;
  /** Office default hourly rate. */
  office: DecimalValue;
};

const present = (v: DecimalValue | null | undefined): v is DecimalValue => v !== null && v !== undefined && dec(v).greaterThan(0);

/**
 * Picks the hourly rate for a time entry, most specific first:
 * case agreement → lawyer+client → client → lawyer → office default.
 */
export function resolveRate(src: RateSources) {
  const order: [keyof RateSources, DecimalValue | null | undefined][] = [
    ["agreement", src.agreement],
    ["userClient", src.userClient],
    ["client", src.client],
    ["user", src.user],
  ];
  for (const [source, value] of order) if (present(value)) return { rate: round2(value), source };
  return { rate: round2(src.office), source: "office" as const };
}
