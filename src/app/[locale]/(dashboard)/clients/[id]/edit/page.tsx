import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { plain } from "@/lib/plain";
import { requirePermission } from "@/lib/session";
import { EntityForm } from "@/components/entity-form";
import { PageHeader, Section } from "@/components/page";
import { updateClient } from "@/server/clients/actions";
import { clientFields } from "../../fields";

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("clients", "update");
  const { id } = await params;
  const t = await getTranslations();
  const client = await prisma.client.findFirst({ where: { id, deletedAt: null } });
  if (!client) notFound();
  return (
    <>
      <PageHeader title={`${t("common.edit")}: ${client.nameAr}`} />
      <Section>
        <EntityForm fields={await clientFields()} schema="client" action={updateClient.bind(null, id)} defaultValues={plain(client)} redirectTo={`/clients/${id}`} />
      </Section>
    </>
  );
}
