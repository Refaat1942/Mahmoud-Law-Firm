import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/session";
import { DataTable } from "@/components/data-table";
import { EntityForm } from "@/components/entity-form";
import { PageHeader, Section } from "@/components/page";
import { createTemplate } from "@/server/documents/templates";
import { templateFields } from "./fields";

export default async function TemplatesPage() {
  const user = await requirePermission("documents");
  const t = await getTranslations();
  const templates = await prisma.template.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } });
  return (
    <>
      <PageHeader title={t("documents.templates")} subtitle={t("documents.templatesHelp")} />
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <DataTable
            emptyText={t("documents.noTemplates")}
            columns={[
              { key: "name", label: t("f.name"), href: "/documents/templates/:id" },
              { key: "category", label: t("f.category"), type: "badge", enumKey: "DocumentCategory" },
              { key: "language", label: t("f.language"), type: "badge", enumKey: "Language" },
              { key: "updatedAt", label: t("documents.updatedAt"), type: "date" },
            ]}
            rows={templates.map((x) => ({ id: x.id, name: x.name, category: x.category, language: x.language, updatedAt: x.updatedAt.toISOString() }))}
          />
        </div>
        {can(user, "documents", "create") && (
          <Section title={t("documents.newTemplate")}>
            <EntityForm schema="template" action={createTemplate} columns={1} defaultValues={{ category: "MEMO", language: "ar" }} fields={await templateFields()} redirectTo="/documents/templates/:id" />
          </Section>
        )}
      </div>
    </>
  );
}
