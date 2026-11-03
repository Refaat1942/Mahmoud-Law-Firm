import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/session";
import { isoDate } from "@/lib/deadlines";
import { addDays } from "@/lib/utils";
import { EntityForm } from "@/components/entity-form";
import { PageHeader, Section } from "@/components/page";
import { createQuote } from "@/server/billing/actions";
import { invoiceFields } from "../../fields";

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ clientId?: string; matterId?: string }> }) {
  const user = await requirePermission("billing", "create");
  const t = await getTranslations();
  const sp = await searchParams;
  return (
    <>
      <PageHeader title={t("billing.newQuote")} />
      <Section>
        <EntityForm
          fields={await invoiceFields(user, "quote")}
          schema="quote"
          action={createQuote}
          defaultValues={{ clientId: sp.clientId, matterId: sp.matterId, date: isoDate(new Date()), validUntil: isoDate(addDays(new Date(), 30)), currency: "AED" }}
          redirectTo="/billing/quotes/:id"
        />
      </Section>
    </>
  );
}
