import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { AlarmClock, Briefcase, CalendarClock, FileWarning, Gavel, ListChecks, Plus, Sparkles, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, matterScope, requirePermission } from "@/lib/session";
import { addDays, localized, localizedTitle, startOfDay } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { Badge, STATUS_TONES } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { DateText } from "@/components/format";
import { PageHeader, Section, StatCard } from "@/components/page";
import { taskScope } from "@/server/tasks/queries";
import { documentScope } from "@/server/documents/queries";
import { openInvoiceWhere } from "@/server/collections/queries";
import { courtUpdateScope } from "@/server/courts/queries";
import { Money } from "@/components/format";
import { dec } from "@/lib/money";

/** Open cases with no timeline activity for this many days are flagged as needing attention. */
const INACTIVE_DAYS = 60;

const LIST_SIZE = 8;

function List({ empty, children }: { empty: string; children: ReactNode[] }) {
  if (!children.length) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return <ul className="divide-y">{children}</ul>;
}

function Row({ href, title, meta, side }: { href: string; title: ReactNode; meta?: ReactNode; side?: ReactNode }) {
  return (
    <li>
      <Link href={href} className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2.5 hover:bg-muted/60">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{title}</p>
          {meta && <p className="truncate text-xs text-muted-foreground">{meta}</p>}
        </div>
        {side && <div className="shrink-0 text-xs">{side}</div>}
      </Link>
    </li>
  );
}

export default async function DashboardPage() {
  const user = await requirePermission("dashboard");
  const t = await getTranslations();
  const locale = await getLocale();
  const today = startOfDay();
  const weekEnd = addDays(today, 7);
  const scope = matterScope(user);
  const show = { matters: can(user, "matters"), hearings: can(user, "hearings"), tasks: can(user, "tasks"), documents: can(user, "documents") };
  const none = Promise.resolve(null);

  const [openMatters, weekHearings, hearings, myOpenTasks, overdueTasks, myTasks, deadlines, deadlineCount, documents] = await Promise.all([
    show.matters ? prisma.matter.count({ where: { AND: [scope, { status: "OPEN" }] } }) : none,
    show.hearings ? prisma.hearing.count({ where: { deletedAt: null, status: "SCHEDULED", date: { gte: today, lt: weekEnd }, matter: scope } }) : none,
    show.hearings
      ? prisma.hearing.findMany({
          where: { deletedAt: null, status: "SCHEDULED", date: { gte: today }, matter: scope },
          include: { matter: true, court: true },
          orderBy: { date: "asc" },
          take: LIST_SIZE,
        })
      : none,
    show.tasks ? prisma.task.count({ where: { deletedAt: null, assigneeId: user.id, status: { not: "DONE" } } }) : none,
    show.tasks ? prisma.task.count({ where: { AND: [taskScope(user), { status: { not: "DONE" }, dueDate: { lt: today } }] } }) : none,
    show.tasks
      ? prisma.task.findMany({
          where: { deletedAt: null, assigneeId: user.id, status: { not: "DONE" } },
          include: { matter: true },
          orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
          take: LIST_SIZE,
        })
      : none,
    show.hearings
      ? prisma.deadline.findMany({ where: { done: false, matter: scope }, include: { matter: true }, orderBy: { dueDate: "asc" }, take: LIST_SIZE })
      : none,
    show.hearings ? prisma.deadline.count({ where: { done: false, dueDate: { lt: weekEnd }, matter: scope } }) : none,
    show.documents
      ? prisma.document.findMany({ where: documentScope(user), include: { matter: true }, orderBy: { updatedAt: "desc" }, take: LIST_SIZE })
      : none,
  ]);

  const inactiveCutoff = addDays(today, -INACTIVE_DAYS);
  const [receivables, pendingUpdates, expiringPoas, inactive] = await Promise.all([
    can(user, "billing") ? prisma.invoice.aggregate({ where: openInvoiceWhere(user), _sum: { total: true, paidAmount: true, creditAmount: true } }) : none,
    show.matters ? prisma.courtUpdate.count({ where: { AND: [courtUpdateScope(user), { status: "PENDING" }] } }) : none,
    can(user, "clients")
      ? prisma.powerOfAttorney.count({ where: { deletedAt: null, expiresAt: { gte: today, lt: addDays(today, 30) }, client: { deletedAt: null } } })
      : none,
    show.matters
      ? prisma.matter.findMany({
          where: { AND: [scope, { status: "OPEN", openedAt: { lt: inactiveCutoff }, events: { none: { createdAt: { gte: inactiveCutoff } } }, hearings: { none: { deletedAt: null, date: { gte: today } } } }] },
          include: { client: true, events: { orderBy: { createdAt: "desc" }, take: 1 } },
          orderBy: { openedAt: "asc" },
          take: LIST_SIZE,
        })
      : none,
  ]);
  const outstanding = receivables
    ? dec(receivables._sum.total ?? 0).minus(receivables._sum.paidAmount ?? 0).minus(receivables._sum.creditAmount ?? 0)
    : null;

  const dueTone = (d: Date | null) => (!d ? "neutral" : d < today ? "danger" : d < addDays(today, 2) ? "warning" : "neutral");
  const matterLabel = (m: { fileNo: string; titleAr: string; titleEn: string | null } | null) => (m ? `${m.fileNo} — ${localizedTitle(m, locale)}` : "");
  const name = locale === "en" ? user.nameEn || user.nameAr : user.nameAr;

  return (
    <>
      <PageHeader
        title={t("dashboard.welcome", { name })}
        subtitle={<DateText value={today} />}
        actions={
          <>
            <Link href="/assistant?q=plan" className={buttonVariants({ variant: "outline" })}>
              <Sparkles /> {t("assistant.planMyDay")}
            </Link>
            {can(user, "matters", "create") && (
              <Link href="/cases/new" className={buttonVariants({ variant: "outline" })}>
                <Plus /> {t("cases.new")}
              </Link>
            )}
            {can(user, "hearings", "create") && (
              <Link href="/hearings/new" className={buttonVariants({ variant: "outline" })}>
                <Plus /> {t("hearings.new")}
              </Link>
            )}
            {can(user, "tasks", "create") && (
              <Link href="/tasks/new" className={buttonVariants()}>
                <Plus /> {t("tasks.new")}
              </Link>
            )}
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {openMatters !== null && <StatCard label={t("dashboard.openCases")} value={openMatters} icon={<Briefcase className="size-5" />} href="/cases" />}
        {weekHearings !== null && (
          <StatCard label={t("dashboard.hearingsWeek")} value={weekHearings} icon={<CalendarClock className="size-5" />} href="/hearings" />
        )}
        {myOpenTasks !== null && (
          <StatCard
            label={t("dashboard.myTasks")}
            value={myOpenTasks}
            hint={overdueTasks ? t("dashboard.overdueCount", { count: overdueTasks }) : undefined}
            icon={<ListChecks className="size-5" />}
            href={overdueTasks ? "/tasks?tab=overdue" : "/tasks"}
          />
        )}
        {deadlineCount !== null && <StatCard label={t("dashboard.deadlinesWeek")} value={deadlineCount} icon={<AlarmClock className="size-5" />} />}
      </div>

      {(outstanding !== null || pendingUpdates !== null || expiringPoas !== null) && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {outstanding !== null && (
            <StatCard label={t("dashboard.receivables")} value={<Money value={outstanding.toFixed(2)} />} icon={<Wallet className="size-5" />} href="/billing/collections" />
          )}
          {pendingUpdates !== null && (
            <StatCard label={t("dashboard.pendingCourtUpdates")} value={pendingUpdates} icon={<Gavel className="size-5" />} href="/court-updates" />
          )}
          {expiringPoas !== null && <StatCard label={t("dashboard.expiringPoas")} value={expiringPoas} icon={<FileWarning className="size-5" />} />}
          {inactive !== null && <StatCard label={t("dashboard.inactiveCases")} value={inactive.length < LIST_SIZE ? inactive.length : `${LIST_SIZE}+`} icon={<Briefcase className="size-5" />} />}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {inactive && inactive.length > 0 && (
          <Section title={t("dashboard.needsAttention", { days: INACTIVE_DAYS })} className="lg:col-span-2">
            <List empty="">
              {inactive.map((m) => (
                <Row
                  key={m.id}
                  href={`/cases/${m.id}`}
                  title={matterLabel(m)}
                  meta={localized(m.client, locale)}
                  side={m.events[0] ? <DateText value={m.events[0].createdAt} /> : t("dashboard.noActivity")}
                />
              ))}
            </List>
          </Section>
        )}
        {hearings && (
          <Section
            title={t("dashboard.upcomingHearings")}
            actions={
              <Link href="/hearings" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                {t("dashboard.viewAll")}
              </Link>
            }
          >
            <List empty={t("dashboard.noHearings")}>
              {hearings.map((h) => (
                <Row
                  key={h.id}
                  href={`/hearings/${h.id}`}
                  title={matterLabel(h.matter)}
                  meta={[localized(h.court, locale), h.room, h.purpose].filter(Boolean).join(" · ")}
                  side={<DateText value={h.date} withTime />}
                />
              ))}
            </List>
          </Section>
        )}
        {myTasks && (
          <Section
            title={t("dashboard.myTasks")}
            actions={
              <Link href="/tasks" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                {t("dashboard.viewAll")}
              </Link>
            }
          >
            <List empty={t("dashboard.noTasks")}>
              {myTasks.map((x) => (
                <Row
                  key={x.id}
                  href={`/tasks/${x.id}`}
                  title={x.title}
                  meta={
                    <span className="flex items-center gap-2">
                      <Badge tone={STATUS_TONES[x.priority]}>{t(`enum.Priority.${x.priority}`)}</Badge>
                      {matterLabel(x.matter)}
                    </span>
                  }
                  side={x.dueDate && <Badge tone={dueTone(x.dueDate)}><DateText value={x.dueDate} /></Badge>}
                />
              ))}
            </List>
          </Section>
        )}
        {deadlines && (
          <Section title={t("dashboard.upcomingDeadlines")}>
            <List empty={t("dashboard.noDeadlines")}>
              {deadlines.map((d) => (
                <Row
                  key={d.id}
                  href={`/cases/${d.matterId}?tab=deadlines`}
                  title={d.title}
                  meta={matterLabel(d.matter)}
                  side={<Badge tone={dueTone(d.dueDate)}><DateText value={d.dueDate} /></Badge>}
                />
              ))}
            </List>
          </Section>
        )}
        {documents && (
          <Section
            title={t("dashboard.recentDocuments")}
            actions={
              <Link href="/documents" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                {t("dashboard.viewAll")}
              </Link>
            }
          >
            <List empty={t("documents.empty")}>
              {documents.map((d) => (
                <Row
                  key={d.id}
                  href={`/documents/${d.id}`}
                  title={d.name}
                  meta={[t(`enum.DocumentCategory.${d.category}`), matterLabel(d.matter)].filter(Boolean).join(" · ")}
                  side={<DateText value={d.updatedAt} />}
                />
              ))}
            </List>
          </Section>
        )}
      </div>
    </>
  );
}
