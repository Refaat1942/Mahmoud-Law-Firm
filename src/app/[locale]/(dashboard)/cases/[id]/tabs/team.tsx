import { getTranslations } from "next-intl/server";
import { Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { localized } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { ActionButton } from "@/components/action-button";
import { EntityForm } from "@/components/entity-form";
import { Section } from "@/components/page";
import { addMember, removeMember } from "@/server/matters/actions";
import { enumOptions, userOptions } from "@/server/options";
import type { TabProps } from "./types";

export async function TeamTab({ matterId, canEdit, locale }: TabProps) {
  const t = await getTranslations();
  const members = await prisma.matterMember.findMany({ where: { matterId }, include: { user: { include: { role: true } } } });
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Section title={t("cases.team")}>
        <Table>
          <thead>
            <tr>
              <Th>{t("f.name")}</Th>
              <Th>{t("f.role")}</Th>
              <Th>{t("f.teamRole")}</Th>
              {canEdit && <Th />}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <Td>{localized(m.user, locale)}</Td>
                <Td>{localized(m.user.role, locale)}</Td>
                <Td>
                  <Badge tone={m.role === "LEAD" ? "accent" : "neutral"}>{t(`enum.MemberRole.${m.role}`)}</Badge>
                </Td>
                {canEdit && (
                  <Td>
                    <ActionButton variant="ghost" size="icon" action={removeMember.bind(null, m.id)} confirm={t("common.confirmDelete")} aria-label={t("common.delete")}>
                      <Trash2 />
                    </ActionButton>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      </Section>
      {canEdit && (
        <Section title={t("cases.addMember")}>
          <EntityForm
            schema="member"
            columns={1}
            action={addMember.bind(null, matterId)}
            resetOnSuccess
            submitLabel={t("common.add")}
            defaultValues={{ role: "MEMBER" }}
            fields={[
              { name: "userId", label: t("f.user"), type: "select", options: await userOptions(), required: true },
              { name: "role", label: t("f.teamRole"), type: "select", options: await enumOptions("MemberRole"), required: true },
            ]}
          />
        </Section>
      )}
    </div>
  );
}
