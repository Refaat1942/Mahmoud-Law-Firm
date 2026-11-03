import { getLocale, getTranslations } from "next-intl/server";
import { FileText, FileType, Upload } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/session";
import { localized } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page";
import { enumOptions } from "@/server/options";
import { documentScope } from "@/server/documents/queries";

export default async function DocumentsPage() {
  const user = await requirePermission("documents");
  const t = await getTranslations();
  const locale = await getLocale();
  const docs = await prisma.document.findMany({
    where: documentScope(user),
    include: { matter: true, client: true, versions: { orderBy: { version: "desc" }, take: 1 } },
    orderBy: { updatedAt: "desc" },
    take: 2000,
  });
  const rows = docs.map((d) => ({
    id: d.id,
    name: d.name,
    fileName: d.versions[0]?.fileName ?? "",
    matter: d.matter?.fileNo ?? "",
    matterId: d.matterId ?? "",
    client: localized(d.client, locale),
    category: d.category,
    folder: d.folder,
    tags: d.tags.join("، "),
    version: d.currentVersion,
    visibleToClient: d.visibleToClient,
    updatedAt: d.updatedAt.toISOString(),
  }));
  const uniq = (key: "folder" | "client") => [...new Set(rows.map((r) => r[key]).filter(Boolean))].sort().map((v) => ({ value: v, label: v }));

  return (
    <>
      <PageHeader
        title={t("documents.title")}
        actions={
          <>
            <Link href="/documents/templates" className={buttonVariants({ variant: "outline" })}>
              <FileType /> {t("documents.templates")}
            </Link>
            {can(user, "documents", "create") && (
              <>
                <Link href="/documents/generate" className={buttonVariants({ variant: "outline" })}>
                  <FileText /> {t("documents.generate")}
                </Link>
                <Link href="/documents/new" className={buttonVariants()}>
                  <Upload /> {t("documents.upload")}
                </Link>
              </>
            )}
          </>
        }
      />
      <DataTable
        exportName="documents"
        emptyText={t("documents.empty")}
        filters={[
          { key: "category", label: t("f.category"), options: await enumOptions("DocumentCategory") },
          { key: "folder", label: t("f.folder"), options: uniq("folder") },
          { key: "client", label: t("f.client"), options: uniq("client") },
        ]}
        columns={[
          { key: "name", label: t("f.name"), href: "/documents/:id" },
          { key: "fileName", label: t("documents.fileName") },
          { key: "matter", label: t("f.matter"), href: "/cases/:matterId" },
          { key: "client", label: t("f.client") },
          { key: "category", label: t("f.category"), type: "badge", enumKey: "DocumentCategory" },
          { key: "folder", label: t("f.folder") },
          { key: "tags", label: t("f.tags") },
          { key: "version", label: t("documents.version"), type: "number" },
          { key: "visibleToClient", label: t("f.visibleToClient"), type: "bool" },
          { key: "updatedAt", label: t("documents.updatedAt"), type: "date" },
        ]}
        rows={rows}
      />
    </>
  );
}
