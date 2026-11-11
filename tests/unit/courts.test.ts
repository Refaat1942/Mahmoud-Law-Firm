import { describe, expect, it } from "vitest";
import { executionSummary, normalizeCaseNo, parseCourtUpdatesCsv } from "../../src/lib/courts";

describe("parseCourtUpdatesCsv", () => {
  it("reads English headers, quoted fields and both date formats", () => {
    const csv = [
      "case_no,kind,execution_type,date,title,details,amount,next_hearing,external_id",
      '123/2026 تجاري,DECISION,,2026-11-05,"تأجيل, لتقديم مذكرة",,,12/11/2026 09:30,R-1',
      "555/2026 تنفيذ,EXECUTION,AMOUNT_COLLECTED,05/11/2026,إيداع مبلغ,,\"12,500.50\",,R-2",
    ].join("\n");
    const { rows, errors } = parseCourtUpdatesCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0].title).toBe("تأجيل, لتقديم مذكرة");
    expect(rows[0].nextHearingAt?.getDate()).toBe(12);
    expect(rows[0].nextHearingAt?.getHours()).toBe(9);
    expect(rows[1].amount).toBe("12500.50");
    expect(rows[1].executionType).toBe("AMOUNT_COLLECTED");
  });

  it("accepts Arabic headers and reports bad lines by number", () => {
    const csv = ["رقم الدعوى,النوع,التاريخ,البيان", "1/2026,HEARING,2026-11-20,جلسة", ",HEARING,2026-11-20,x", "2/2026,FOO,2026-11-20,x", "3/2026,EXECUTION,2026-11-20,x", "4/2026,STAGE,20-11-2026,x"].join("\n");
    const { rows, errors } = parseCourtUpdatesCsv(csv);
    expect(rows).toHaveLength(1);
    expect(errors.map((e) => [e.line, e.error])).toEqual([
      [3, "caseNo"],
      [4, "kind"],
      [5, "executionType"],
      [6, "date"],
    ]);
  });

  it("rejects missing required headers", () => {
    expect(parseCourtUpdatesCsv("a,b\n1,2").errors[0].error).toBe("headers");
  });
});

describe("normalizeCaseNo", () => {
  it("ignores spacing around slashes and case", () => {
    expect(normalizeCaseNo(" 123 / 2026  Commercial ")).toBe(normalizeCaseNo("123/2026 commercial"));
  });
});

describe("executionSummary", () => {
  const d = (n: number) => new Date(2026, 0, n);
  it("totals collections and fees and tracks measures still in force", () => {
    const s = executionSummary([
      { type: "TRAVEL_BAN", date: d(1) },
      { type: "BANK_ATTACHMENT", date: d(2) },
      { type: "VEHICLE_ATTACHMENT", date: d(3) },
      { type: "AMOUNT_COLLECTED", date: d(4), amount: "10000" },
      { type: "DEPOSIT", date: d(5), amount: 2500.5 },
      { type: "COURT_FEE", date: d(6), amount: 300 },
      { type: "ATTACHMENT_LIFTED", date: d(7) },
      { type: "TRAVEL_BAN_LIFTED", date: d(8) },
    ]);
    expect(s.collected.toFixed(2)).toBe("12500.50");
    expect(s.fees.toFixed(2)).toBe("300.00");
    expect(s.activeTravelBans).toBe(0);
    expect(s.activeAttachments).toBe(1);
  });
});
