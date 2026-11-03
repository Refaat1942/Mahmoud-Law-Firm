import "server-only";
import { prisma } from "@/lib/prisma";
import { matterScope, type CurrentUser } from "@/lib/session";
import { addDays, startOfDay } from "@/lib/utils";

export type RollRange = "day" | "week";

export function rollWindow(date: string | undefined, range: RollRange) {
  const from = startOfDay(date ? new Date(date) : new Date());
  return { from, to: addDays(from, range === "week" ? 7 : 1) };
}

export async function hearingRoll(user: CurrentUser, date: string | undefined, range: RollRange, lawyerId?: string) {
  const { from, to } = rollWindow(date, range);
  const rows = await prisma.hearing.findMany({
    where: { deletedAt: null, date: { gte: from, lt: to }, matter: matterScope(user), ...(lawyerId ? { lawyerId } : {}) },
    include: {
      matter: {
        include: {
          client: true,
          parties: { include: { party: true } },
          // Fallback for hearings created without a link to the previous one.
          hearings: { where: { deletedAt: null, date: { lt: from }, decision: { not: null } }, orderBy: { date: "desc" }, take: 1 },
        },
      },
      court: true,
      lawyer: true,
      previous: true,
    },
    orderBy: [{ date: "asc" }, { court: { nameEn: "asc" } }],
  });
  return { from, to, rows };
}

type RollHearing = Awaited<ReturnType<typeof hearingRoll>>["rows"][number];

/**
 * The six roll columns used by the page and the PDF: court & client capacity, court level, client,
 * opponent, last decision with its date, and the lawyer's requests for this hearing.
 */
export function rollColumns(h: RollHearing, locale: string) {
  const name = (r: { nameAr: string; nameEn?: string | null } | null | undefined) => (r ? (locale === "en" ? r.nameEn || r.nameAr : r.nameAr) : "");
  const last = h.previous?.decision ? h.previous : h.matter.hearings[0];
  return {
    court: [name(h.court), h.room].filter(Boolean).join(" / "),
    capacity: h.matter.clientRole ?? "",
    caseNo: h.matter.courtCaseNo ?? "",
    level: h.matter.level,
    client: name(h.matter.client),
    opponent: h.matter.parties
      .filter((p) => p.role === "OPPONENT")
      .map((p) => name(p.party))
      .join("، "),
    lastDecisionDate: last?.date ?? null,
    lastDecision: last?.decision ?? "",
    requests: h.purpose ?? "",
  };
}
