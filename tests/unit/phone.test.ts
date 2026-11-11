import { describe, expect, it } from "vitest";
import { normalizePhone } from "../../src/lib/phone";

describe("normalizePhone", () => {
  it("adds the UAE code to local numbers", () => {
    expect(normalizePhone("050 123 4567")).toBe("971501234567");
    expect(normalizePhone("501234567")).toBe("971501234567");
    expect(normalizePhone("04 555 1234")).toBe("97145551234");
  });
  it("keeps international numbers", () => {
    expect(normalizePhone("+971 50 123 4567")).toBe("971501234567");
    expect(normalizePhone("00966 55 123 4567")).toBe("966551234567");
    expect(normalizePhone("+20 100 123 4567")).toBe("201001234567");
  });
  it("rejects what cannot be a number", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});
