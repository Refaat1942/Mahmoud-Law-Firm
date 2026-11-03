import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/session";
import { EntityForm } from "@/components/entity-form";
import { PageHeader, Section } from "@/components/page";
import { createHearing } from "@/server/hearings/actions";
import { hearingFields } from "../fields";

export default async function NewHearingPage({ searchParams }: { searchParams: Promise<{ matterId?: string; date?: string }> }) {
  const user = await requirePermission("hearings", "create");
  const t = await getTranslations();
  const sp = await searchParams;
  return (
    <>
      <PageHeader title={t("hearings.new")} />
      <Section>
        <EntityForm
          fields={await hearingFields(user)}
          schema="hearing"
          action={createHearing}
          defaultValues={{ matterId: sp.matterId, date: sp.date ? `${sp.date.slice(0, 10)}T09:00:00` : undefined }}
          redirectTo="/hearings/:id"
        />
      </Section>
    </>
  );
}
