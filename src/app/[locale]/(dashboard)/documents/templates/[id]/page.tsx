import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/session";
import { ActionButton } from "@/components/action-button";
import { EntityForm } from "@/components/entity-form";
import { PageHeader, Section } from "@/components/page";
import { deleteTemplate, updateTemplate } from "@/server/documents/templates";
import { templateFields } from "../fields";

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("documents");
  const { id } = await params;
  const t = await getTranslations();
  const tpl = await prisma.template.findFirst({ where: { id, deletedAt: null } });
  if (!tpl) notFound();
  return (
    <>
      <PageHeader
        title={tpl.name}
        actions={
          can(user, "documents", "delete") && (
            <ActionButton variant="destructive" action={deleteTemplate.bind(null, id)} confirm={t("common.confirmDelete")} redirectTo="/documents/templates">
              <Trash2 /> {t("common.delete")}
            </ActionButton>
          )
        }
      />
      <Section>
        {can(user, "documents", "update") ? (
          <EntityForm schema="template" action={updateTemplate.bind(null, id)} defaultValues={tpl} fields={await templateFields()} />
        ) : (
          <pre className="whitespace-pre-wrap text-sm">{tpl.body}</pre>
        )}
      </Section>
    </>
  );
}
