import { getTranslations } from "next-intl/server";
import { Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { ActionButton } from "@/components/action-button";
import { EntityForm } from "@/components/entity-form";
import { Section } from "@/components/page";
import { addMatterParty, removeMatterParty } from "@/server/matters/actions";
import { enumOptions, partyOptions } from "@/server/options";
import type { TabProps } from "./types";

export async function PartiesTab({ matterId, canEdit }: TabProps) {
  const t = await getTranslations();
  const parties = await prisma.matterParty.findMany({ where: { matterId }, include: { party: true }, orderBy: { role: "asc" } });
  return (
    <div className="space-y-5">
      <Section title={t("cases.parties")}>
        {parties.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("f.partyRole")}</Th>
                <Th>{t("f.name")}</Th>
                <Th>{t("f.idNumber")}</Th>
                <Th>{t("f.phone")}</Th>
                <Th>{t("f.notes")}</Th>
                {canEdit && <Th />}
              </tr>
            </thead>
            <tbody>
              {parties.map((p) => (
                <tr key={p.id}>
                  <Td>
                    <Badge tone={p.role === "OPPONENT" ? "danger" : "neutral"}>{t(`enum.MatterPartyRole.${p.role}`)}</Badge>
                  </Td>
                  <Td>
                    <Link href={`/clients/parties/${p.partyId}`} className="hover:underline">
                      {p.party.nameAr} {p.party.nameEn && <span className="text-muted-foreground">/ {p.party.nameEn}</span>}
                    </Link>
                  </Td>
                  <Td dir="ltr">{p.party.idNumber}</Td>
                  <Td dir="ltr">{p.party.phone}</Td>
                  <Td>{p.notes}</Td>
                  {canEdit && (
                    <Td>
                      <ActionButton variant="ghost" size="icon" action={removeMatterParty.bind(null, p.id)} confirm={t("common.confirmDelete")} aria-label={t("common.delete")}>
                        <Trash2 />
                      </ActionButton>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>
      {canEdit && (
        <Section title={t("cases.addParty")}>
          <EntityForm
            schema="matterParty"
            action={addMatterParty.bind(null, matterId)}
            resetOnSuccess
            submitLabel={t("common.add")}
            defaultValues={{ role: "OPPONENT" }}
            fields={[
              { name: "role", label: t("f.partyRole"), type: "select", options: await enumOptions("MatterPartyRole"), required: true },
              { name: "partyId", label: t("cases.existingParty"), type: "select", options: await partyOptions() },
              { name: "newPartyName", label: t("cases.newPartyName"), help: t("cases.newPartyHelp") },
              { name: "notes", label: t("f.notes") },
            ]}
          />
        </Section>
      )}
    </div>
  );
}
