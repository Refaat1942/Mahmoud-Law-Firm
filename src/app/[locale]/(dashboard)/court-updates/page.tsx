import { getLocale, getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/session";
import { COURT_ADAPTERS } from "@/lib/courts";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { CsvImport } from "@/components/csv-import";
import { DataTable } from "@/components/data-table";
import { PageHeader, Section, Tabs } from "@/components/page";
import { enumOptions } from "@/server/options";
import { importCourtUpdates } from "@/server/courts/actions";
import { courtUpdateScope } from "@/server/courts/queries";

const TABS = ["PENDING", "APPLIED", "DISMISSED"] as const;

export default async function CourtUpdatesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requirePermission("matters");
  const t = await getTranslations();
  await getLocale();
  const requested = (await searchParams).tab;
  const tab = TABS.find((x) => x === requested) ?? "PENDING";
  const rows = await prisma.courtUpdate.findMany({ where: { AND: [courtUpdateScope(user), { status: tab }] }, include: { matter: true }, orderBy: { occurredAt: "desc" }, take: 1000 });
  const canEdit = can(user, "matters", "update");
  return (
    <>
      <PageHeader
        title={t("courts.updatesTitle")}
        subtitle={t("courts.updatesSubtitle")}
        actions={
          canEdit && (
            <Link href="/court-updates/new" className={buttonVariants()}>
              <Plus /> {t("courts.newUpdate")}
            </Link>
          )
        }
      />
      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Section title={t("courts.sources")}>
          <ul className="space-y-2 text-sm">
            {COURT_ADAPTERS.map((a) => (
              <li key={a.key} className="flex items-center justify-between gap-2">
                <span>{t(`enum.CourtSystem.${a.court}`)}</span>
                <Badge tone={a.connected ? "success" : "neutral"}>{a.connected ? t("courts.connected") : t("courts.notConnected")}</Badge>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">{t("courts.sourcesHelp")}</p>
        </Section>
        {canEdit && (
          <Section title={t("courts.importTitle")}>
            <CsvImport action={importCourtUpdates} />
            <p className="mt-3 text-xs text-muted-foreground" dir="ltr">
              case_no,kind,execution_type,date,title,details,amount,next_hearing,external_id
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t("courts.importHelp")}</p>
          </Section>
        )}
      </div>
      <Tabs base="/court-updates" active={tab} tabs={TABS.map((key) => ({ key, label: t(`enum.CourtUpdateStatus.${key}`) }))} />
      <DataTable
        exportName={`court-updates-${tab.toLowerCase()}`}
        emptyText={t("common.empty")}
        filters={[{ key: "kind", label: t("f.type"), options: await enumOptions("CourtUpdateKind") }]}
        columns={[
          { key: "occurredAt", label: t("f.date"), type: "date", href: "/court-updates/:id" },
          { key: "title", label: t("f.title"), href: "/court-updates/:id" },
          { key: "kind", label: t("f.type"), type: "badge", enumKey: "CourtUpdateKind" },
          { key: "courtCaseNo", label: t("f.courtCaseNo") },
          { key: "matter", label: t("f.matter"), href: "/cases/:matterId" },
          { key: "source", label: t("courts.source") },
        ]}
        rows={rows.map((u) => ({
          id: u.id,
          occurredAt: u.occurredAt.toISOString(),
          title: u.title,
          kind: u.kind,
          courtCaseNo: u.courtCaseNo,
          matter: u.matter?.fileNo ?? t("courts.unmatched"),
          matterId: u.matterId ?? "",
          source: t(`courts.sourceKinds.${u.source === "csv" ? "csv" : u.source === "manual" ? "manual" : "adapter"}`),
        }))}
      />
    </>
  );
}
