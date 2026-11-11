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
import { noticeScope } from "@/server/notices/queries";

export default async function NoticesPage() {
  const user = await requirePermission("matters");
  const t = await getTranslations();
  const locale = await getLocale();
  const today = startOfDay();
  const rows = await prisma.legalNotice.findMany({ where: noticeScope(user), include: { client: true, matter: true, assignee: true }, orderBy: [{ createdAt: "desc" }], take: 2000 });
  const pending = rows.filter((n) => n.status === "SENT" || n.status === "DRAFT");
  const running = rows.filter((n) => n.dueDate && n.dueDate >= today);
  const expired = rows.filter((n) => n.dueDate && n.dueDate < today);
  return (
    <>
      <PageHeader
        title={t("notices.title")}
        subtitle={t("notices.subtitle")}
        actions={
          can(user, "matters", "create") && (
            <Link href="/notices/new" className={buttonVariants()}>
              <Plus /> {t("notices.new")}
            </Link>
          )
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label={t("notices.awaitingService")} value={pending.length} />
        <StatCard label={t("notices.running")} value={running.length} />
        <StatCard label={t("notices.expired")} value={expired.length} />
      </div>
      <DataTable
        exportName="notices"
        emptyText={t("notices.empty")}
        filters={[
          { key: "direction", label: t("notices.direction"), options: await enumOptions("NoticeDirection") },
          { key: "status", label: t("notices.delivery"), options: await enumOptions("NoticeStatus") },
        ]}
        columns={[
          { key: "title", label: t("f.title"), href: "/notices/:id" },
          { key: "direction", label: t("notices.direction"), type: "badge", enumKey: "NoticeDirection" },
          { key: "client", label: t("f.client") },
          { key: "counterparty", label: t("notices.counterparty") },
          { key: "matter", label: t("f.matter"), href: "/cases/:matterId" },
          { key: "servedAt", label: t("notices.servedAt"), type: "date" },
          { key: "dueDate", label: t("notices.dueDate"), type: "date" },
          { key: "status", label: t("notices.delivery"), type: "badge", enumKey: "NoticeStatus" },
        ]}
        rows={rows.map((n) => ({
          id: n.id,
          title: n.title,
          direction: n.direction,
          client: localized(n.client, locale),
          counterparty: n.counterparty,
          matter: n.matter?.fileNo ?? "",
          matterId: n.matterId ?? "",
          servedAt: n.servedAt?.toISOString() ?? "",
          dueDate: n.dueDate?.toISOString() ?? "",
          status: n.status,
        }))}
      />
    </>
  );
}
