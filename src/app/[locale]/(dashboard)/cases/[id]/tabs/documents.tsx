import { getTranslations } from "next-intl/server";
import { Upload } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/session";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import type { TabProps } from "./types";

export async function DocumentsTab({ matterId, user }: TabProps) {
  const t = await getTranslations();
  const docs = await prisma.document.findMany({ where: { matterId, deletedAt: null }, include: { versions: { orderBy: { version: "desc" }, take: 1 } }, orderBy: { createdAt: "desc" } });
  return (
    <div className="space-y-3">
      {can(user, "documents", "create") && (
        <div className="flex flex-wrap gap-2">
          <Link href={`/documents/new?matterId=${matterId}`} className={buttonVariants()}>
            <Upload /> {t("documents.upload")}
          </Link>
          {/* "Generate from template" returns with the templates phase (/documents/generate). */}
        </div>
      )}
      <DataTable
        exportName="matter-documents"
        filters={[{ key: "folder", label: t("f.folder"), options: [...new Set(docs.map((d) => d.folder))].map((v) => ({ value: v, label: v })) }]}
        columns={[
          { key: "name", label: t("f.name"), href: "/documents/:id" },
          { key: "category", label: t("f.category"), type: "badge", enumKey: "DocumentCategory" },
          { key: "folder", label: t("f.folder") },
          { key: "version", label: t("documents.version"), type: "number" },
          { key: "visibleToClient", label: t("f.visibleToClient"), type: "bool" },
          { key: "createdAt", label: t("f.createdAt"), type: "date" },
        ]}
        rows={docs.map((d) => ({
          id: d.id,
          name: d.name,
          category: d.category,
          folder: d.folder,
          version: d.currentVersion,
          visibleToClient: d.visibleToClient,
          createdAt: d.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
