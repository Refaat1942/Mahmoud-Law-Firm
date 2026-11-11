import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { can, matterScope, requirePermission } from "@/lib/session";
import { addDays, localized, localizedTitle, startOfDay } from "@/lib/utils";
import { isoDate } from "@/lib/deadlines";
import { buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { DataTable } from "@/components/data-table";
import { PageHeader, Section, StatCard } from "@/components/page";
import { userOptions } from "@/server/options";
import { taskScope } from "@/server/tasks/queries";

/**
 * Daily updates queue: everything that needs someone to act, computed live from the records, so an item
 * leaves the queue as soon as the decision is recorded, the task is done or the case moves again.
 */
export default async function UpdatesPage({ searchParams }: { searchParams: Promise<{ lawyer?: string; idle?: string }> }) {
  const user = await requirePermission("dashboard");
  const t = await getTranslations();
  const locale = await getLocale();
  const sp = await searchParams;
  const lawyer = sp.lawyer ?? "";
  const idleDays = Math.min(365, Math.max(7, Number(sp.idle) || 30));
  const today = startOfDay();
  const scope = matterScope(user);
  const byLawyer = lawyer ? { responsibleId: lawyer } : {};

  const [hearings, deadlines, tasks, openMatters] = await Promise.all([
    can(user, "hearings")
      ? prisma.hearing.findMany({
          where: { deletedAt: null, status: "SCHEDULED", date: { lt: today }, matter: { AND: [scope, byLawyer] } },
          include: { matter: { include: { client: true, responsible: true } }, court: true, lawyer: true },
          orderBy: { date: "asc" },
          take: 500,
        })
      : [],
    can(user, "hearings")
      ? prisma.deadline.findMany({
          where: { done: false, dueDate: { lt: today }, matter: { AND: [scope, byLawyer] } },
          include: { matter: { include: { responsible: true } }, assignee: true },
          orderBy: { dueDate: "asc" },
          take: 500,
        })
      : [],
    can(user, "tasks")
      ? prisma.task.findMany({
          where: { AND: [taskScope(user), { status: { not: "DONE" }, dueDate: { lt: today } }, lawyer ? { assigneeId: lawyer } : {}] },
          include: { assignee: true, matter: true },
          orderBy: { dueDate: "asc" },
          take: 500,
        })
      : [],
    can(user, "matters")
      ? prisma.matter.findMany({
          where: { AND: [scope, byLawyer, { status: "OPEN" }] },
          include: {
            client: true,
            responsible: true,
            events: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
            hearings: { where: { deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 1, select: { updatedAt: true } },
          },
          take: 3000,
        })
      : [],
  ]);
  const idleSince = addDays(today, -idleDays);
  const idle = openMatters
    .map((m) => {
      const last = [m.updatedAt, m.events[0]?.createdAt, m.hearings[0]?.updatedAt].filter(Boolean).sort((a, b) => +b! - +a!)[0]!;
      return { m, last };
    })
    .filter(({ last }) => last < idleSince)
    .sort((a, b) => +a.last - +b.last);

  return (
    <>
      <PageHeader title={t("updates.title")} subtitle={t("updates.subtitle")} />
      <form className="no-print mb-4 flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span>{t("f.responsible")}</span>
          <Select name="lawyer" defaultValue={lawyer} className="w-52">
            <option value="">{t("common.all")}</option>
            {(await userOptions()).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1 text-sm">
          <span>{t("updates.idleDays")}</span>
          <Input type="number" name="idle" min={7} max={365} defaultValue={idleDays} className="w-28" />
        </label>
        <button className={buttonVariants({ variant: "outline" })}>{t("common.apply")}</button>
      </form>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("updates.noOutcome")} value={hearings.length} />
        <StatCard label={t("updates.overdueDeadlines")} value={deadlines.length} />
        <StatCard label={t("updates.overdueTasks")} value={tasks.length} />
        <StatCard label={t("updates.idleCases", { days: idleDays })} value={idle.length} />
      </div>
      <div className="space-y-5">
        {can(user, "hearings") && (
          <Section title={t("updates.noOutcome")}>
            <DataTable
              exportName="updates-hearings"
              pageSize={10}
              emptyText={t("updates.clear")}
              columns={[
                { key: "date", label: t("f.dateTime"), type: "datetime", href: "/hearings/:id" },
                { key: "fileNo", label: t("f.fileNo"), href: "/cases/:matterId" },
                { key: "client", label: t("f.client") },
                { key: "court", label: t("f.court") },
                { key: "lawyer", label: t("f.lawyer") },
                { key: "responsible", label: t("f.responsible") },
              ]}
              rows={hearings.map((h) => ({
                id: h.id,
                date: h.date.toISOString(),
                fileNo: h.matter.fileNo,
                matterId: h.matterId,
                client: localized(h.matter.client, locale),
                court: localized(h.court, locale),
                lawyer: localized(h.lawyer, locale),
                responsible: localized(h.matter.responsible, locale),
              }))}
            />
          </Section>
        )}
        {can(user, "hearings") && (
          <Section title={t("updates.overdueDeadlines")}>
            <DataTable
              exportName="updates-deadlines"
              pageSize={10}
              emptyText={t("updates.clear")}
              columns={[
                { key: "dueDate", label: t("f.dueDate"), type: "date" },
                { key: "title", label: t("f.title"), href: "/cases/:matterId?tab=deadlines" },
                { key: "fileNo", label: t("f.fileNo"), href: "/cases/:matterId" },
                { key: "assignee", label: t("f.assignee") },
                { key: "responsible", label: t("f.responsible") },
              ]}
              rows={deadlines.map((d) => ({
                id: d.id,
                dueDate: d.dueDate.toISOString(),
                title: d.title,
                fileNo: d.matter.fileNo,
                matterId: d.matterId,
                assignee: localized(d.assignee, locale),
                responsible: localized(d.matter.responsible, locale),
              }))}
            />
          </Section>
        )}
        {can(user, "tasks") && (
          <Section title={t("updates.overdueTasks")}>
            <DataTable
              exportName="updates-tasks"
              pageSize={10}
              emptyText={t("updates.clear")}
              columns={[
                { key: "dueDate", label: t("f.dueDate"), type: "date" },
                { key: "title", label: t("f.title"), href: "/tasks/:id" },
                { key: "fileNo", label: t("f.fileNo") },
                { key: "assignee", label: t("f.assignee") },
                { key: "priority", label: t("f.priority"), type: "badge", enumKey: "Priority" },
              ]}
              rows={tasks.map((x) => ({
                id: x.id,
                dueDate: x.dueDate?.toISOString() ?? "",
                title: x.title,
                fileNo: x.matter?.fileNo ?? "",
                assignee: localized(x.assignee, locale),
                priority: x.priority,
              }))}
            />
          </Section>
        )}
        {can(user, "matters") && (
          <Section title={t("updates.idleCases", { days: idleDays })}>
            <DataTable
              exportName="updates-idle-cases"
              pageSize={10}
              emptyText={t("updates.clear")}
              columns={[
                { key: "fileNo", label: t("f.fileNo"), href: "/cases/:id" },
                { key: "title", label: t("f.title") },
                { key: "client", label: t("f.client") },
                { key: "responsible", label: t("f.responsible") },
                { key: "last", label: t("updates.lastActivity"), type: "date" },
              ]}
              rows={idle.map(({ m, last }) => ({
                id: m.id,
                fileNo: m.fileNo,
                title: localizedTitle(m, locale),
                client: localized(m.client, locale),
                responsible: localized(m.responsible, locale),
                last: last.toISOString(),
              }))}
            />
          </Section>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{t("updates.help", { date: isoDate(today) })}</p>
    </>
  );
}
