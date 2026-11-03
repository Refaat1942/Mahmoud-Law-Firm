import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";

/** The parts of a user the agenda needs; kept free of next-auth so the worker can use it. */
export type AgendaUser = { id: string; scopeAll: boolean; perms: Set<string> };

export const scopeFor = (u: AgendaUser): Prisma.MatterWhereInput =>
  u.scopeAll ? { deletedAt: null } : { deletedAt: null, OR: [{ responsibleId: u.id }, { members: { some: { userId: u.id } } }] };

const day = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
const time = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);

/** Hearings, deadlines and the user's tasks for the next `days` days, as plain data for the model. */
export async function agendaFor(u: AgendaUser, days = 7, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + Math.min(Math.max(days, 1), 31));
  const scope = scopeFor(u);
  const can = (p: string) => u.perms.has(p);
  const [hearings, deadlines, tasks, overdueTasks] = await Promise.all([
    can("hearings:view")
      ? prisma.hearing.findMany({
          where: { deletedAt: null, status: "SCHEDULED", date: { gte: start, lt: end }, matter: scope },
          include: { court: true, matter: { include: { client: true, parties: { where: { role: "OPPONENT" }, include: { party: true } } } } },
          orderBy: { date: "asc" },
          take: 50,
        })
      : [],
    can("hearings:view")
      ? prisma.deadline.findMany({ where: { done: false, dueDate: { lt: end }, matter: scope }, include: { matter: true }, orderBy: { dueDate: "asc" }, take: 30 })
      : [],
    can("tasks:view")
      ? prisma.task.findMany({ where: { deletedAt: null, assigneeId: u.id, status: { not: "DONE" }, OR: [{ dueDate: null }, { dueDate: { lt: end } }] }, include: { matter: true }, orderBy: { dueDate: "asc" }, take: 40 })
      : [],
    can("tasks:view") ? prisma.task.count({ where: { deletedAt: null, assigneeId: u.id, status: { not: "DONE" }, dueDate: { lt: start } } }) : 0,
  ]);
  return {
    today: day(now),
    hearings: hearings.map((h) => ({
      date: day(h.date),
      time: time(h.date),
      fileNo: h.matter.fileNo,
      caseTitle: h.matter.titleAr,
      courtCaseNo: h.matter.courtCaseNo,
      court: h.court?.nameAr ?? null,
      room: h.room,
      client: h.matter.client.nameAr,
      opponent: h.matter.parties.map((p) => p.party.nameAr).join("، ") || null,
      requests: h.purpose,
    })),
    deadlines: deadlines.map((d) => ({ due: day(d.dueDate), overdue: d.dueDate < start, title: d.title, fileNo: d.matter.fileNo })),
    myTasks: tasks.map((t) => ({ title: t.title, due: t.dueDate ? day(t.dueDate) : null, overdue: !!t.dueDate && t.dueDate < start, priority: t.priority, status: t.status, fileNo: t.matter?.fileNo ?? null })),
    overdueTaskCount: overdueTasks,
  };
}
