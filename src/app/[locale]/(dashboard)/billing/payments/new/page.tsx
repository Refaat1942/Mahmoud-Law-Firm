import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { isoDate } from "@/lib/deadlines";
import { localized } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { PaymentForm } from "@/components/payment-form";
import { PageHeader, Section } from "@/components/page";
import { bankOptions, clientOptions, enumOptions } from "@/server/options";
import { createPayment } from "@/server/billing/actions";
import { openInvoices } from "@/server/billing/queries";

export default async function NewPaymentPage({ searchParams }: { searchParams: Promise<{ clientId?: string; invoiceId?: string }> }) {
  const user = await requirePermission("billing", "create");
  const t = await getTranslations();
  const locale = await getLocale();
  const sp = await searchParams;
  const clients = await clientOptions();

  if (!sp.clientId) {
    return (
      <>
        <PageHeader title={t("billing.recordPayment")} />
        <Section>
          <form className="flex flex-wrap items-end gap-3">
            <label className="min-w-72 flex-1 space-y-1 text-sm">
              <span>{t("f.client")}</span>
              <Select name="clientId" required>
                <option value="">{t("common.select")}</option>
                {clients.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </label>
            <button className={buttonVariants()}>{t("common.next")}</button>
          </form>
        </Section>
      </>
    );
  }

  const client = await prisma.client.findFirstOrThrow({ where: { id: sp.clientId, deletedAt: null } });
  const open = await openInvoices(user, client.id);
  const selected = open.find((i) => i.id === sp.invoiceId);
  const banks = await bankOptions();

  return (
    <>
      <PageHeader title={t("billing.recordPayment")} subtitle={localized(client, locale)} />
      <Section>
        <PaymentForm
          mode="create"
          action={createPayment}
          clientId={client.id}
          invoices={open.map((i) => ({ id: i.id, number: i.number, due: i.due.toFixed(2), currency: i.currency, issueDate: i.issueDate.toISOString() }))}
          banks={banks}
          methods={await enumOptions("PaymentMethod")}
          defaults={{ date: isoDate(new Date()), amount: selected?.due.toFixed(2), invoiceId: selected?.id, bankAccountId: banks[0]?.value }}
          redirectTo={selected ? `/billing/invoices/${selected.id}` : "/billing/payments"}
        />
      </Section>
    </>
  );
}
