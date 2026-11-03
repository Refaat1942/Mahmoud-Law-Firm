import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { plain } from "@/lib/plain";
import { can, requirePermission } from "@/lib/session";
import { localized, localizedTitle } from "@/lib/utils";
import { EntityForm } from "@/components/entity-form";
import { ActionButton } from "@/components/action-button";
import { DataTable } from "@/components/data-table";
import { PageHeader, Section } from "@/components/page";
import { deleteParty, updateParty } from "@/server/clients/actions";
import { partyFields } from "../../fields";

export default async function PartyPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("clients");
  const { id } = await params;
  const t = await getTranslations();
  const locale = await getLocale();
  const party = await prisma.party.findFirst({
    where: { id, deletedAt: null },
    include: { matters: { include: { matter: { include: { client: true } } } } },
  });
  if (!party) notFound();

  return (
    <>
      <PageHeader
        title={party.nameAr}
        subtitle={party.nameEn}
        actions={
          can(user, "clients", "delete") && (
            <ActionButton variant="destructive" action={deleteParty.bind(null, id)} confirm={t("common.confirmDelete")} redirectTo="/clients?tab=parties">
              {t("common.delete")}
            </ActionButton>
          )
        }
      />
      <div className="space-y-5">
        <Section>
          <EntityForm fields={await partyFields()} schema="party" action={updateParty.bind(null, id)} defaultValues={plain(party)} />
        </Section>
        <Section title={t("nav.cases")}>
          <DataTable
            columns={[
              { key: "fileNo", label: t("f.fileNo"), href: "/cases/:matterId" },
              { key: "title", label: t("f.title") },
              { key: "client", label: t("f.client") },
              { key: "role", label: t("f.partyRole"), type: "badge", enumKey: "MatterPartyRole" },
            ]}
            rows={party.matters.map((mp) => ({
              id: mp.id,
              matterId: mp.matterId,
              fileNo: mp.matter.fileNo,
              title: localizedTitle(mp.matter, locale),
              client: localized(mp.matter.client, locale),
              role: mp.role,
            }))}
          />
        </Section>
      </div>
    </>
  );
}
