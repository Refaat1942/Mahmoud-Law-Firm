import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { EntityForm } from "@/components/entity-form";
import { PageHeader, Section } from "@/components/page";
import { matterOptions } from "@/server/options";
import { generateDocument } from "@/server/documents/templates";

export default async function GeneratePage({ searchParams }: { searchParams: Promise<{ matterId?: string; templateId?: string }> }) {
  const user = await requirePermission("documents", "create");
  const t = await getTranslations();
  const sp = await searchParams;
  const templates = await prisma.template.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } });
  const tpl = templates.find((x) => x.id === sp.templateId);

  if (!templates.length) {
    return (
      <>
        <PageHeader title={t("documents.generate")} />
        <Section>
          <p className="mb-3 text-sm text-muted-foreground">{t("documents.noTemplates")}</p>
          <Link href="/documents/templates" className={buttonVariants()}>
            {t("documents.newTemplate")}
          </Link>
        </Section>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("documents.generate")} subtitle={t("documents.generateHelp")} />
      <div className="grid gap-5 xl:grid-cols-3">
        <Section title={t("documents.chooseTemplate")}>
          <ul className="space-y-1">
            {templates.map((x) => (
              <li key={x.id}>
                <Link
                  href={`/documents/generate?${new URLSearchParams({ templateId: x.id, ...(sp.matterId ? { matterId: sp.matterId } : {}) })}`}
                  className={buttonVariants({ variant: x.id === tpl?.id ? "default" : "ghost", className: "w-full justify-start" })}
                >
                  {x.name} <span className="text-xs opacity-70">({t(`enum.Language.${x.language}`)})</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
        {tpl && (
          <Section title={tpl.name} className="xl:col-span-2">
            <pre className="mb-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-xs" dir={tpl.language === "en" ? "ltr" : "rtl"}>
              {tpl.body}
            </pre>
            <EntityForm
              key={tpl.id}
              schema="generate"
              action={generateDocument.bind(null, tpl.id)}
              defaultValues={{ matterId: sp.matterId, format: "pdf" }}
              redirectTo="/documents/:id"
              submitLabel={t("documents.generateSave")}
              fields={[
                { name: "matterId", label: t("f.matter"), type: "select", options: await matterOptions(user, {}), required: true, span: 2 },
                {
                  name: "format",
                  label: t("documents.format"),
                  type: "select",
                  required: true,
                  options: [
                    { value: "pdf", label: "PDF" },
                    { value: "docx", label: "Word (DOCX)" },
                  ],
                },
                { name: "note", label: t("f.notes") },
              ]}
            />
          </Section>
        )}
      </div>
    </>
  );
}
