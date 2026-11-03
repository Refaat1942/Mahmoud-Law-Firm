import { getLocale, getTranslations } from "next-intl/server";
import { Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { getOffice } from "@/lib/settings";
import { localized } from "@/lib/utils";
import { Table, Td, Th } from "@/components/ui/table";
import { ActionButton } from "@/components/action-button";
import { EntityForm } from "@/components/entity-form";
import { Money } from "@/components/format";
import { PageHeader, Section } from "@/components/page";
import { clientOptions, userOptions } from "@/server/options";
import { deleteRate, saveRate } from "@/server/time/actions";

export default async function RatesPage() {
  await requirePermission("time", "approve");
  const t = await getTranslations();
  const locale = await getLocale();
  const [rates, office] = await Promise.all([
    prisma.rate.findMany({ include: { user: true, client: true }, orderBy: [{ updatedAt: "desc" }] }),
    getOffice(),
  ]);

  return (
    <>
      <PageHeader title={t("time.rates")} subtitle={t("time.ratesHelp", { rate: office.defaultHourlyRate })} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title={t("time.ratesList")}>
          {rates.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>{t("f.lawyer")}</Th>
                  <Th>{t("f.client")}</Th>
                  <Th>{t("f.hourlyRate")}</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {rates.map((r) => (
                  <tr key={r.id}>
                    <Td>{r.user ? localized(r.user, locale) : <span className="text-muted-foreground">{t("time.anyLawyer")}</span>}</Td>
                    <Td>{r.client ? localized(r.client, locale) : <span className="text-muted-foreground">{t("time.anyClient")}</span>}</Td>
                    <Td>
                      <Money value={r.amount.toString()} />
                    </Td>
                    <Td>
                      <ActionButton variant="ghost" size="icon" action={deleteRate.bind(null, r.id)} confirm={t("common.confirmDelete")} aria-label={t("common.delete")}>
                        <Trash2 />
                      </ActionButton>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Section>
        <Section title={t("time.addRate")}>
          <EntityForm
            schema="rate"
            action={saveRate}
            resetOnSuccess
            fields={[
              { name: "userId", label: t("f.lawyer"), type: "select", options: await userOptions(), placeholder: t("time.anyLawyer") },
              { name: "clientId", label: t("f.client"), type: "select", options: await clientOptions(), placeholder: t("time.anyClient") },
              { name: "amount", label: t("f.hourlyRate"), type: "money", required: true },
            ]}
          />
          <p className="mt-3 text-xs text-muted-foreground">{t("time.rateOrder")}</p>
        </Section>
      </div>
    </>
  );
}
