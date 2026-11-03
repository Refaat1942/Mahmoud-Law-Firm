import { getLocale, getTranslations } from "next-intl/server";
import { CalendarDays, Plus, Printer } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, matterScope, requirePermission } from "@/lib/session";
import { localized, localizedTitle, startOfDay } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { PageHeader, Tabs } from "@/components/page";
import { enumOptions } from "@/server/options";

export default async function HearingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requirePermission("hearings");
  const t = await getTranslations();
  const locale = await getLocale();
  const tab = (await searchParams).tab ?? "upcoming";
  const today = startOfDay();
  const hearings = await prisma.hearing.findMany({
    where: {
      deletedAt: null,
      matter: matterScope(user),
      ...(tab === "upcoming" ? { date: { gte: today } } : tab === "pending" ? { date: { lt: today }, status: "SCHEDULED" } : { date: { lt: today } }),
    },
    include: { matter: { include: { client: true } }, court: true, lawyer: true },
    orderBy: { date: tab === "upcoming" ? "asc" : "desc" },
    take: 1000,
  });
  const rows = hearings.map((h) => ({
    id: h.id,
    date: h.date.toISOString(),
    fileNo: h.matter.fileNo,
    matter: localizedTitle(h.matter, locale),
    matterId: h.matterId,
    courtCaseNo: h.matter.courtCaseNo ?? "",
    client: localized(h.matter.client, locale),
    court: localized(h.court, locale),
    room: h.room ?? "",
    lawyer: localized(h.lawyer, locale),
    purpose: h.purpose ?? "",
    decision: h.decision ?? "",
    status: h.status,
  }));

  return (
    <>
      <PageHeader
        title={t("hearings.title")}
        actions={
          <>
            <Link href="/hearings/roll" className={buttonVariants({ variant: "outline" })}>
              <Printer /> {t("hearings.roll")}
            </Link>
            <Link href="/calendar" className={buttonVariants({ variant: "outline" })}>
              <CalendarDays /> {t("nav.calendar")}
            </Link>
            {can(user, "hearings", "create") && (
              <Link href="/hearings/new" className={buttonVariants()}>
                <Plus /> {t("hearings.new")}
              </Link>
            )}
          </>
        }
      />
      <Tabs
        base="/hearings"
        active={tab}
        tabs={[
          { key: "upcoming", label: t("hearings.upcoming") },
          { key: "pending", label: t("hearings.pendingDecision") },
          { key: "past", label: t("hearings.past") },
        ]}
      />
      <DataTable
        exportName={`hearings-${tab}`}
        filters={[
          { key: "status", label: t("f.status"), options: await enumOptions("HearingStatus") },
          { key: "lawyer", label: t("f.lawyer"), options: [...new Set(rows.map((r) => r.lawyer).filter(Boolean))].map((v) => ({ value: v, label: v })) },
          { key: "court", label: t("f.court"), options: [...new Set(rows.map((r) => r.court).filter(Boolean))].map((v) => ({ value: v, label: v })) },
        ]}
        columns={[
          { key: "date", label: t("f.dateTime"), type: "datetime", href: "/hearings/:id" },
          { key: "fileNo", label: t("f.fileNo"), href: "/cases/:matterId" },
          { key: "matter", label: t("f.matter") },
          { key: "courtCaseNo", label: t("f.courtCaseNo") },
          { key: "client", label: t("f.client") },
          { key: "court", label: t("f.court") },
          { key: "room", label: t("f.room") },
          { key: "lawyer", label: t("f.lawyer") },
          { key: tab === "upcoming" ? "purpose" : "decision", label: tab === "upcoming" ? t("f.purpose") : t("f.decision") },
          { key: "status", label: t("f.status"), type: "badge", enumKey: "HearingStatus" },
        ]}
        rows={rows}
      />
    </>
  );
}
