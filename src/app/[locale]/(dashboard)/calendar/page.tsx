import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { can, matterScope, requirePermission } from "@/lib/session";
import { addDays, localized } from "@/lib/utils";
import { PageHeader } from "@/components/page";
import { userOptions } from "@/server/options";
import { CalendarView, type CalendarEvent } from "./calendar-view";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ lawyer?: string }> }) {
  const user = await requirePermission("hearings");
  const t = await getTranslations();
  const locale = await getLocale();
  const lawyer = (await searchParams).lawyer ?? "";
  const from = addDays(new Date(), -120);
  const to = addDays(new Date(), 365);
  const scope = matterScope(user);

  const [hearings, deadlines, tasks] = await Promise.all([
    prisma.hearing.findMany({
      where: { deletedAt: null, date: { gte: from, lte: to }, matter: scope, ...(lawyer ? { lawyerId: lawyer } : {}) },
      include: { matter: true, court: true },
    }),
    prisma.deadline.findMany({
      where: { dueDate: { gte: from, lte: to }, matter: scope, ...(lawyer ? { assigneeId: lawyer } : {}) },
      include: { matter: true },
    }),
    can(user, "tasks")
      ? prisma.task.findMany({
          where: {
            deletedAt: null,
            dueDate: { gte: from, lte: to },
            ...(lawyer ? { assigneeId: lawyer } : user.scopeAll ? {} : { assigneeId: user.id }),
          },
        })
      : [],
  ]);

  const events: CalendarEvent[] = [
    ...hearings.map((h) => ({
      id: `h-${h.id}`,
      title: `${h.matter.fileNo} · ${localized(h.court, locale) || t("hearings.hearing")}`,
      start: h.date.toISOString(),
      url: `/${locale}/hearings/${h.id}`,
      kind: "hearing" as const,
      done: h.status !== "SCHEDULED",
    })),
    ...deadlines.map((d) => ({
      id: `d-${d.id}`,
      title: `⏱ ${d.title} (${d.matter.fileNo})`,
      start: d.dueDate.toISOString().slice(0, 10),
      allDay: true,
      url: `/${locale}/cases/${d.matterId}?tab=deadlines`,
      kind: "deadline" as const,
      done: d.done,
    })),
    ...tasks.map((x) => ({
      id: `t-${x.id}`,
      title: `✓ ${x.title}`,
      start: x.dueDate!.toISOString().slice(0, 10),
      allDay: true,
      url: `/${locale}/tasks/${x.id}`,
      kind: "task" as const,
      done: x.status === "DONE",
    })),
  ];

  return (
    <>
      <PageHeader title={t("nav.calendar")} subtitle={t("hearings.calendarHelp")} />
      <CalendarView events={events} lawyers={await userOptions()} lawyer={lawyer} canCreate={can(user, "hearings", "create")} />
    </>
  );
}
