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
    include: { matter: { include: { client: true, parties: { include: { party: true } } } }, court: true, lawyer: true, previous: true },
    orderBy: [{ date: "asc" }, { court: { nameEn: "asc" } }],
  });
  return { from, to, rows };
}
