import { getLocale, getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/session";
import { localized, startOfDay } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { PageHeader, StatCard } from "@/components/page";
import { enumOptions } from "@/server/options";
import { filingScope } from "@/server/courts/queries";

const OPEN = ["PENDING", "SUBMITTED", "UNDER_REVIEW"] as const;

export default async function CourtFilingsPage() {
  const user = await requirePermission("matters");
  const t = await getTranslations();
  const locale = await getLocale();
  const today = startOfDay();
  const rows = await prisma.courtFiling.findMany({ where: filingScope(user), include: { matter: true, assignee: true }, orderBy: [{ createdAt: "desc" }], take: 2000 });
  const open = rows.filter((r) => (OPEN as readonly string[]).includes(r.status));
  const due = open.filter((r) => (r.followUpAt && r.followUpAt <= today) || (r.responseDueAt && r.responseDueAt <= today));
  return (
    <>
      <PageHeader
        title={t("courts.filingsTitle")}
        subtitle={t("courts.filingsSubtitle")}
        actions={
          can(user, "matters", "create") && (
            <Link href="/court-filings/new" className={buttonVariants()}>
              <Plus /> {t("courts.newFiling")}
            </Link>
          )
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label={t("courts.openFilings")} value={open.length} />
        <StatCard label={t("courts.followUpDue")} value={due.length} />
        <StatCard label={t("courts.communications")} value={open.filter((r) => r.kind === "COMMUNICATION").length} />
      </div>
      <DataTable
        exportName="court-filings"
        emptyText={t("common.empty")}
        filters={[
          { key: "kind", label: t("f.type"), options: await enumOptions("FilingKind") },
          { key: "direction", label: t("courts.direction"), options: await enumOptions("FilingDirection") },
          { key: "status", label: t("f.status"), options: await enumOptions("FilingStatus") },
        ]}
        columns={[
          { key: "title", label: t("f.title"), href: "/court-filings/:id" },
          { key: "kind", label: t("f.type"), type: "badge", enumKey: "FilingKind" },
          { key: "direction", label: t("courts.direction"), type: "badge", enumKey: "FilingDirection" },
          { key: "fileNo", label: t("f.matter"), href: "/cases/:matterId" },
          { key: "submittedAt", label: t("courts.submittedAt"), type: "date" },
          { key: "followUpAt", label: t("courts.followUpAt"), type: "date" },
          { key: "assignee", label: t("f.assignee") },
          { key: "status", label: t("f.status"), type: "badge", enumKey: "FilingStatus" },
        ]}
        rows={rows.map((r) => ({
          id: r.id,
          title: r.title,
          kind: r.kind,
          direction: r.direction,
          fileNo: r.matter.fileNo,
          matterId: r.matterId,
          submittedAt: r.submittedAt?.toISOString() ?? "",
          followUpAt: (r.followUpAt ?? r.responseDueAt)?.toISOString() ?? "",
          assignee: localized(r.assignee, locale),
          status: r.status,
        }))}
      />
    </>
  );
}
