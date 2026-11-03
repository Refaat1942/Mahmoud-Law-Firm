import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/session";
import { isoDate } from "@/lib/deadlines";
import { addDays } from "@/lib/utils";
import { EntityForm } from "@/components/entity-form";
import { PageHeader, Section } from "@/components/page";
import { createInvoice } from "@/server/billing/actions";
import { invoiceFields } from "../../fields";

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ clientId?: string; matterId?: string }> }) {
  const user = await requirePermission("billing", "create");
  const t = await getTranslations();
  const sp = await searchParams;
  const today = new Date();
  return (
    <>
      <PageHeader title={t("billing.newInvoice")} subtitle={t("billing.newInvoiceHelp")} />
      <Section>
        <EntityForm
          fields={await invoiceFields(user, "invoice")}
          schema="invoice"
          action={createInvoice}
          defaultValues={{ clientId: sp.clientId, matterId: sp.matterId, issueDate: isoDate(today), dueDate: isoDate(addDays(today, 30)), currency: "AED" }}
          redirectTo="/billing/invoices/:id"
        />
      </Section>
    </>
  );
}
