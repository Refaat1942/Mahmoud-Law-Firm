import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { plain } from "@/lib/plain";
import { matterScope, requirePermission } from "@/lib/session";
import { EntityForm } from "@/components/entity-form";
import { PageHeader, Section } from "@/components/page";
import { updateMatter } from "@/server/matters/actions";
import { matterFields } from "../../fields";

export default async function EditCasePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("matters", "update");
  const { id } = await params;
  const t = await getTranslations();
  const matter = await prisma.matter.findFirst({ where: { AND: [matterScope(user), { id }] } });
  if (!matter) notFound();
  const fields = (await matterFields(user)).map((f) => (f.name === "parentId" ? { ...f, options: f.options?.filter((o) => o.value !== id) } : f));
  return (
    <>
      <PageHeader title={`${t("common.edit")}: ${matter.fileNo}`} />
      <Section>
        <EntityForm fields={fields} schema="matter" action={updateMatter.bind(null, id)} defaultValues={plain(matter)} redirectTo={`/cases/${id}`} />
      </Section>
    </>
  );
}
