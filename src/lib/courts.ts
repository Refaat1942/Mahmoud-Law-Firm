import { dec, round2, sum, type DecimalValue } from "./money";

export const COURT_UPDATE_KINDS = ["HEARING", "DECISION", "EXECUTION", "PARTY", "DOCUMENT", "STAGE", "NEW_CASE", "OTHER"] as const;
export type CourtUpdateKind = (typeof COURT_UPDATE_KINDS)[number];
export const EXECUTION_TYPES = [
  "DECISION",
  "BANK_ATTACHMENT",
  "TRAVEL_BAN",
  "TRAVEL_BAN_LIFTED",
  "PROPERTY_ATTACHMENT",
  "VEHICLE_ATTACHMENT",
  "ATTACHMENT_LIFTED",
  "EXECUTION_HEARING",
  "AMOUNT_COLLECTED",
  "DEPOSIT",
  "EXPERT_REPORT",
  "VALUATION",
  "AUCTION",
  "COURT_FEE",
  "REQUEST",
  "OTHER",
] as const;
export type ExecutionType = (typeof EXECUTION_TYPES)[number];

/**
 * Court systems the office may connect to. None is connected: each needs officially authorised access
 * (credentials or an integration agreement) from the court. Until then updates are entered or imported by
 * staff, and the adapter is reported as not connected rather than simulated.
 */
export const COURT_ADAPTERS = [
  { key: "adjd", court: "ADJD", connected: false },
  { key: "dubai", court: "DUBAI", connected: false },
  { key: "moj", court: "MOJ", connected: false },
] as const;

export type ParsedUpdate = {
  courtCaseNo: string;
  kind: CourtUpdateKind;
  executionType?: ExecutionType;
  occurredAt: Date;
  title: string;
  details?: string;
  amount?: string;
  nextHearingAt?: Date;
  externalId?: string;
};

/** Splits one CSV line, honouring double-quoted fields with "" escapes. */
function splitCsv(line: string) {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

const HEADERS: Record<string, keyof ParsedUpdate> = {
  case_no: "courtCaseNo",
  "رقم الدعوى": "courtCaseNo",
  kind: "kind",
  "النوع": "kind",
  execution_type: "executionType",
  "نوع إجراء التنفيذ": "executionType",
  date: "occurredAt",
  "التاريخ": "occurredAt",
  title: "title",
  "البيان": "title",
  details: "details",
  "التفاصيل": "details",
  amount: "amount",
  "المبلغ": "amount",
  next_hearing: "nextHearingAt",
  "الجلسة القادمة": "nextHearingAt",
  external_id: "externalId",
  "المرجع": "externalId",
};

const toDate = (v: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/.exec(v) ?? null;
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}))?$/.exec(v);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0));
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]), Number(dmy[4] ?? 0), Number(dmy[5] ?? 0));
  return null;
};

/**
 * Parses a CSV export of court updates (Arabic or English headers). Dates are YYYY-MM-DD or DD/MM/YYYY,
 * optionally with HH:MM. Returns the valid rows and a line-numbered error list for the rest.
 */
export function parseCourtUpdatesCsv(text: string) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const rows: ParsedUpdate[] = [];
  const errors: { line: number; error: string }[] = [];
  if (!lines.length) return { rows, errors: [{ line: 0, error: "empty" }] };
  const head = splitCsv(lines[0]).map((h) => HEADERS[h.toLowerCase()] ?? HEADERS[h]);
  if (!head.includes("courtCaseNo") || !head.includes("kind") || !head.includes("occurredAt") || !head.includes("title"))
    return { rows, errors: [{ line: 1, error: "headers" }] };
  lines.slice(1).forEach((line, i) => {
    const cells = splitCsv(line);
    const rec: Record<string, string> = {};
    head.forEach((h, j) => h && (rec[h] = cells[j] ?? ""));
    const lineNo = i + 2;
    const kind = rec.kind?.toUpperCase() as CourtUpdateKind;
    if (!rec.courtCaseNo) return errors.push({ line: lineNo, error: "caseNo" });
    if (!COURT_UPDATE_KINDS.includes(kind)) return errors.push({ line: lineNo, error: "kind" });
    const occurredAt = toDate(rec.occurredAt ?? "");
    if (!occurredAt) return errors.push({ line: lineNo, error: "date" });
    if (!rec.title) return errors.push({ line: lineNo, error: "title" });
    const executionType = rec.executionType ? (rec.executionType.toUpperCase() as ExecutionType) : undefined;
    if (executionType && !EXECUTION_TYPES.includes(executionType)) return errors.push({ line: lineNo, error: "executionType" });
    if (kind === "EXECUTION" && !executionType) return errors.push({ line: lineNo, error: "executionType" });
    const nextHearingAt = rec.nextHearingAt ? toDate(rec.nextHearingAt) : null;
    if (rec.nextHearingAt && !nextHearingAt) return errors.push({ line: lineNo, error: "date" });
    const amount = rec.amount ? rec.amount.replace(/,/g, "") : undefined;
    if (amount && !/^\d+(\.\d{1,2})?$/.test(amount)) return errors.push({ line: lineNo, error: "amount" });
    rows.push({
      courtCaseNo: rec.courtCaseNo,
      kind,
      executionType,
      occurredAt,
      title: rec.title.slice(0, 300),
      details: rec.details || undefined,
      amount,
      nextHearingAt: nextHearingAt ?? undefined,
      externalId: rec.externalId || undefined,
    });
  });
  return { rows, errors };
}

/** Normalises a court case number for matching ("123 / 2026 تجاري" ~ "123/2026 تجاري"). */
export const normalizeCaseNo = (v: string) => v.replace(/\s+/g, " ").replace(/\s*\/\s*/g, "/").trim().toLowerCase();

/** Execution file totals: money collected (incl. deposits), court fees paid, and measures still in force. */
export function executionSummary(actions: { type: ExecutionType; date: Date; amount?: DecimalValue | null }[]) {
  const sorted = [...actions].sort((a, b) => +a.date - +b.date);
  const total = (types: ExecutionType[]) => round2(sum(sorted.filter((a) => types.includes(a.type)).map((a) => dec(a.amount ?? 0))));
  let travelBans = 0;
  let attachments = 0;
  for (const a of sorted) {
    if (a.type === "TRAVEL_BAN") travelBans++;
    if (a.type === "TRAVEL_BAN_LIFTED") travelBans = Math.max(0, travelBans - 1);
    if (a.type === "BANK_ATTACHMENT" || a.type === "PROPERTY_ATTACHMENT" || a.type === "VEHICLE_ATTACHMENT") attachments++;
    if (a.type === "ATTACHMENT_LIFTED") attachments = Math.max(0, attachments - 1);
  }
  return { collected: total(["AMOUNT_COLLECTED", "DEPOSIT"]), fees: total(["COURT_FEE"]), activeTravelBans: travelBans, activeAttachments: attachments };
}
