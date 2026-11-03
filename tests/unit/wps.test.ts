import { describe, expect, it } from "vitest";
import { buildSif } from "../../src/lib/wps";

describe("buildSif", () => {
  it("writes EDR lines and the SCR control record", () => {
    const sif = buildSif({
      employerId: "1234567",
      bankCode: "600310101",
      period: "2026-02",
      createdAt: new Date(2026, 2, 1, 9, 5, 7),
      employees: [
        { molPersonId: "12345", bankRoutingCode: "600310101", iban: "AE070331234567890123456", fixed: "10000", variable: "500.5", leaveDays: 2 },
        { molPersonId: "67890", bankRoutingCode: "600320101", iban: "AE460260001234567890123", fixed: 8000, variable: 0, leaveDays: 0 },
      ],
    });
    const lines = sif.content.trimEnd().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("EDR,00000000012345,600310101,AE070331234567890123456,2026-02-01,2026-02-28,28,10000.00,500.50,2");
    expect(lines[2]).toBe("SCR,0000001234567,600310101,2026-03-01,0905,022026,2,18500.50,AED,");
    expect(sif.total.toFixed(2)).toBe("18500.50");
    expect(sif.fileName).toBe("0000001234567260301090507.SIF");
  });
});
