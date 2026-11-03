import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/session";
import { EntityForm } from "@/components/entity-form";
import { PageHeader, Section } from "@/components/page";
import { createParty } from "@/server/clients/actions";
import { partyFields } from "../../fields";

export default async function NewPartyPage() {
  await requirePermission("clients", "create");
  const t = await getTranslations();
  return (
    <>
      <PageHeader title={t("clients.newParty")} />
      <Section>
        <EntityForm fields={await partyFields()} schema="party" action={createParty} defaultValues={{ type: "INDIVIDUAL" }} redirectTo="/clients?tab=parties" />
      </Section>
    </>
  );
}
