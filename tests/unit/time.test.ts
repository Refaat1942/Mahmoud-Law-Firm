import { describe, expect, it } from "vitest";
import { hoursToMinutes, resolveRate, timeAmount } from "../../src/lib/time";

describe("hoursToMinutes", () => {
  it("rounds to whole minutes", () => {
    expect(hoursToMinutes(1.25)).toBe(75);
    expect(hoursToMinutes(0.1)).toBe(6);
    expect(hoursToMinutes(0.333)).toBe(20);
  });
});

describe("timeAmount", () => {
  it("prices minutes at the hourly rate and rounds to fils", () => {
    expect(timeAmount(1000, 90).toFixed(2)).toBe("1500.00");
    expect(timeAmount(950, 20).toFixed(2)).toBe("316.67");
    expect(timeAmount("1234.56", 0).toFixed(2)).toBe("0.00");
  });
});

describe("resolveRate", () => {
  it("uses the most specific rate available", () => {
    expect(resolveRate({ agreement: 1500, userClient: 1200, client: 1100, user: 900, office: 800 })).toMatchObject({ source: "agreement" });
    expect(resolveRate({ userClient: 1200, client: 1100, user: 900, office: 800 })).toMatchObject({ source: "userClient" });
    expect(resolveRate({ client: 1100, user: 900, office: 800 })).toMatchObject({ source: "client" });
    expect(resolveRate({ user: 900, office: 800 })).toMatchObject({ source: "user" });
  });

  it("falls back to the office default and ignores zero rates", () => {
    const r = resolveRate({ agreement: 0, user: null, office: 800 });
    expect(r.source).toBe("office");
    expect(r.rate.toFixed(2)).toBe("800.00");
  });
});
