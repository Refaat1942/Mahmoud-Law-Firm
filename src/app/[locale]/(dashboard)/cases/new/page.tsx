import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/session";
import { isoDate } from "@/lib/deadlines";
import { EntityForm } from "@/components/entity-form";
import { PageHeader, Section } from "@/components/page";
import { createMatter } from "@/server/matters/actions";
import { matterFields } from "../fields";

export default async function NewCasePage({ searchParams }: { searchParams: Promise<{ clientId?: string; parentId?: string }> }) {
  const user = await requirePermission("matters", "create");
  const t = await getTranslations();
  const sp = await searchParams;
  return (
    <>
      <PageHeader title={t("cases.new")} />
      <Section>
        <EntityForm
          fields={await matterFields(user)}
          schema="matter"
          action={createMatter}
          defaultValues={{ clientId: sp.clientId, parentId: sp.parentId, status: "OPEN", level: sp.parentId ? "APPEAL" : "FIRST_INSTANCE", openedAt: isoDate(new Date()), responsibleId: user.id }}
          redirectTo="/cases/:id"
        />
      </Section>
    </>
  );
}
