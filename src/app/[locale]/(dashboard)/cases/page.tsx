import { getLocale, getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, matterScope, requirePermission } from "@/lib/session";
import { localized, localizedTitle } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page";
import { enumOptions } from "@/server/options";

export default async function CasesPage() {
  const user = await requirePermission("matters");
  const t = await getTranslations();
  const locale = await getLocale();
  const now = new Date();
  const matters = await prisma.matter.findMany({
    where: matterScope(user),
    include: {
      client: true,
      court: true,
      type: true,
      responsible: true,
      hearings: { where: { deletedAt: null, date: { gte: now }, status: "SCHEDULED" }, orderBy: { date: "asc" }, take: 1 },
    },
    orderBy: { openedAt: "desc" },
  });

  const rows = matters.map((m) => ({
    id: m.id,
    fileNo: m.fileNo,
    courtCaseNo: m.courtCaseNo ?? "",
    title: localizedTitle(m, locale),
    client: localized(m.client, locale),
    type: localized(m.type, locale),
    level: m.level,
    court: localized(m.court, locale),
    responsible: localized(m.responsible, locale),
    status: m.status,
    nextHearing: m.hearings[0]?.date.toISOString() ?? "",
  }));
  const uniq = (key: "type" | "court" | "responsible") => [...new Set(rows.map((r) => r[key]).filter(Boolean))].map((v) => ({ value: v, label: v }));

  return (
    <>
      <PageHeader
        title={t("cases.title")}
        actions={
          can(user, "matters", "create") && (
            <Link href="/cases/new" className={buttonVariants()}>
              <Plus /> {t("cases.new")}
            </Link>
          )
        }
      />
      <DataTable
        exportName="cases"
        filters={[
          { key: "status", label: t("f.status"), options: await enumOptions("MatterStatus") },
          { key: "level", label: t("f.level"), options: await enumOptions("MatterLevel") },
          { key: "type", label: t("f.matterType"), options: uniq("type") },
          { key: "court", label: t("f.court"), options: uniq("court") },
          { key: "responsible", label: t("f.responsible"), options: uniq("responsible") },
        ]}
        columns={[
          { key: "fileNo", label: t("f.fileNo"), href: "/cases/:id" },
          { key: "title", label: t("f.title"), href: "/cases/:id" },
          { key: "client", label: t("f.client") },
          { key: "courtCaseNo", label: t("f.courtCaseNo") },
          { key: "type", label: t("f.matterType") },
          { key: "level", label: t("f.level"), type: "badge", enumKey: "MatterLevel" },
          { key: "court", label: t("f.court") },
          { key: "responsible", label: t("f.responsible") },
          { key: "nextHearing", label: t("cases.nextHearing"), type: "datetime" },
          { key: "status", label: t("f.status"), type: "badge", enumKey: "MatterStatus" },
        ]}
        rows={rows}
      />
    </>
  );
}
