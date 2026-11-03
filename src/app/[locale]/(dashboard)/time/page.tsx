import { getLocale, getTranslations } from "next-intl/server";
import { CheckCheck, Plus, Send, Tags, X } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/session";
import { timeAmount } from "@/lib/time";
import { addDays, localized, localizedTitle, startOfDay } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { ActionButton } from "@/components/action-button";
import { DataTable } from "@/components/data-table";
import { PageHeader, StatCard, Tabs } from "@/components/page";
import { enumOptions } from "@/server/options";
import { reviewTime, submitTime } from "@/server/time/actions";
import { timeScope } from "@/server/time/queries";

const TABS = ["mine", "review", "all"] as const;

export default async function TimePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requirePermission("time");
  const t = await getTranslations();
  const locale = await getLocale();
  const approver = can(user, "time", "approve");
  const tabs = TABS.filter((k) => k === "mine" || approver);
  const requested = (await searchParams).tab;
  const tab = tabs.find((k) => k === requested) ?? "mine";

  const where: Record<(typeof TABS)[number], Prisma.TimeEntryWhereInput> = {
    mine: { userId: user.id },
    review: { status: "SUBMITTED" },
    all: {},
  };
  const entries = await prisma.timeEntry.findMany({
    where: { AND: [timeScope(user), where[tab]] },
    include: { user: true, matter: { include: { client: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 2000,
  });

  const today = startOfDay();
  // The UAE work week has started on Monday since 2022.
  const weekStart = addDays(today, -((today.getDay() + 6) % 7));
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const mine = await prisma.timeEntry.findMany({ where: { deletedAt: null, userId: user.id, date: { gte: monthStart < weekStart ? monthStart : weekStart } }, select: { date: true, minutes: true, billable: true } });
  const hours = (from: Date, billableOnly = false) => (mine.filter((e) => e.date >= from && (!billableOnly || e.billable)).reduce((a, e) => a + e.minutes, 0) / 60).toFixed(2);
  const drafts = await prisma.timeEntry.count({ where: { deletedAt: null, userId: user.id, status: { in: ["DRAFT", "REJECTED"] } } });
  const pending = approver ? await prisma.timeEntry.count({ where: { AND: [timeScope(user), { status: "SUBMITTED" }] } }) : 0;

  const rows = entries.map((e) => ({
    id: e.id,
    date: e.date.toISOString(),
    user: localized(e.user, locale),
    matter: `${e.matter.fileNo} — ${localizedTitle(e.matter, locale)}`,
    matterId: e.matterId,
    client: localized(e.matter.client, locale),
    description: e.description,
    minutes: e.minutes,
    billable: e.billable,
    amount: e.billable ? timeAmount(e.rate, e.minutes).toFixed(2) : "0",
    status: e.status,
  }));

  return (
    <>
      <PageHeader
        title={t("time.title")}
        actions={
          <>
            {approver && (
              <Link href="/time/rates" className={buttonVariants({ variant: "outline" })}>
                <Tags /> {t("time.rates")}
              </Link>
            )}
            {tab === "mine" && drafts > 0 && (
              <ActionButton variant="outline" action={submitTime} payload={{}} confirm={t("time.confirmSubmitAll", { count: drafts })}>
                <Send /> {t("time.submitAll", { count: drafts })}
              </ActionButton>
            )}
            {tab === "review" && rows.length > 0 && (
              <>
                <ActionButton variant="outline" action={reviewTime} payload={{ decision: "REJECTED" }} confirm={t("time.confirmRejectAll", { count: rows.length })}>
                  <X /> {t("time.rejectAll")}
                </ActionButton>
                <ActionButton action={reviewTime} payload={{ decision: "APPROVED" }} confirm={t("time.confirmApproveAll", { count: rows.length })}>
                  <CheckCheck /> {t("time.approveAll", { count: rows.length })}
                </ActionButton>
              </>
            )}
            {can(user, "time", "create") && (
              <Link href="/time/new" className={buttonVariants()}>
                <Plus /> {t("time.new")}
              </Link>
            )}
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("time.weekHours")} value={hours(weekStart)} />
        <StatCard label={t("time.monthHours")} value={hours(monthStart)} />
        <StatCard label={t("time.monthBillable")} value={hours(monthStart, true)} />
        {approver ? (
          <StatCard label={t("time.pendingApproval")} value={pending} href="/time?tab=review" />
        ) : (
          <StatCard label={t("time.drafts")} value={drafts} />
        )}
      </div>
      <Tabs base="/time" active={tab} tabs={tabs.map((key) => ({ key, label: t(`time.tabs.${key}`) }))} />
      <DataTable
        exportName={`time-${tab}`}
        emptyText={t("time.empty")}
        filters={[
          { key: "status", label: t("f.status"), options: await enumOptions("TimeStatus") },
          ...(tab === "mine" ? [] : [{ key: "user", label: t("f.lawyer"), options: [...new Set(rows.map((r) => r.user))].map((v) => ({ value: v, label: v })) }]),
          { key: "client", label: t("f.client"), options: [...new Set(rows.map((r) => r.client))].map((v) => ({ value: v, label: v })) },
        ]}
        columns={[
          { key: "date", label: t("f.date"), type: "date", href: "/time/:id" },
          ...(tab === "mine" ? [] : [{ key: "user", label: t("f.lawyer") }]),
          { key: "matter", label: t("f.matter"), href: "/cases/:matterId" },
          { key: "client", label: t("f.client") },
          { key: "description", label: t("f.description"), href: "/time/:id" },
          { key: "minutes", label: t("f.hours"), type: "hours" },
          { key: "billable", label: t("f.billable"), type: "bool" },
          { key: "amount", label: t("f.amount"), type: "money" },
          { key: "status", label: t("f.status"), type: "badge", enumKey: "TimeStatus" },
        ]}
        rows={rows}
      />
    </>
  );
}
