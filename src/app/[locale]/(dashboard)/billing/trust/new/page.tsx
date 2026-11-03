import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/session";
import { isoDate } from "@/lib/deadlines";
import { EntityForm } from "@/components/entity-form";
import { PageHeader, Section } from "@/components/page";
import { bankOptions, clientOptions, enumOptions, matterOptions } from "@/server/options";
import { createTrustTransaction } from "@/server/billing/actions";

export default async function NewTrustPage({ searchParams }: { searchParams: Promise<{ clientId?: string; matterId?: string }> }) {
  const user = await requirePermission("billing", "create");
  const t = await getTranslations();
  const sp = await searchParams;
  const banks = await bankOptions();
  return (
    <>
      <PageHeader title={t("billing.newTrust")} subtitle={t("billing.trustHelp")} />
      <Section>
        <EntityForm
          schema="trust"
          action={createTrustTransaction}
          redirectTo="/billing/trust"
          defaultValues={{ clientId: sp.clientId, matterId: sp.matterId, date: isoDate(new Date()), type: "DEPOSIT", bankAccountId: banks.at(-1)?.value }}
          fields={[
            { name: "clientId", label: t("f.client"), type: "select", options: await clientOptions(), required: true },
            { name: "matterId", label: t("f.matter"), type: "select", options: await matterOptions(user, {}) },
            { name: "type", label: t("f.type"), type: "select", options: await enumOptions("TrustEntryType"), required: true },
            { name: "date", label: t("f.date"), type: "date", required: true },
            { name: "amount", label: t("f.amount"), type: "money", required: true },
            { name: "bankAccountId", label: t("f.bankAccount"), type: "select", options: banks, required: true },
            { name: "notes", label: t("f.notes"), type: "textarea" },
          ]}
        />
      </Section>
    </>
  );
}
