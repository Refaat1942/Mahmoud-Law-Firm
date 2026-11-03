import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { balanceDue } from "@/lib/billing";
import { isoDate } from "@/lib/deadlines";
import { localized } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { EntityForm } from "@/components/entity-form";
import { PageHeader, Section } from "@/components/page";
import { bankOptions, clientOptions, enumOptions } from "@/server/options";
import { createPayment } from "@/server/billing/actions";
import { invoiceScope } from "@/server/billing/queries";

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
  const open = await prisma.invoice.findMany({
    where: { AND: [invoiceScope(user), { clientId: client.id, status: { in: ["ISSUED", "PARTIALLY_PAID"] } }] },
    orderBy: { issueDate: "asc" },
  });
  const invoiceOpts = open.map((i) => ({ value: i.id, label: `${i.number} — ${t("billing.balance")}: ${balanceDue(i).toFixed(2)} ${i.currency}` }));
  const selected = open.find((i) => i.id === sp.invoiceId);
  const banks = await bankOptions();

  return (
    <>
      <PageHeader title={t("billing.recordPayment")} subtitle={localized(client, locale)} />
      <Section>
        <EntityForm
          schema="payment"
          action={createPayment}
          redirectTo={selected ? `/billing/invoices/${selected.id}` : "/billing/payments"}
          defaultValues={{
            clientId: client.id,
            invoiceId: selected?.id,
            amount: selected ? balanceDue(selected).toFixed(2) : undefined,
            date: isoDate(new Date()),
            method: "TRANSFER",
            bankAccountId: banks[0]?.value,
          }}
          fields={[
            { name: "clientId", label: t("f.client"), type: "select", options: clients, required: true },
            { name: "invoiceId", label: t("f.invoice"), type: "select", options: invoiceOpts, placeholder: t("billing.onAccount") },
            { name: "date", label: t("f.date"), type: "date", required: true },
            { name: "amount", label: t("f.amount"), type: "money", required: true },
            { name: "method", label: t("f.method"), type: "select", options: await enumOptions("PaymentMethod"), required: true },
            { name: "bankAccountId", label: t("f.bankAccount"), type: "select", options: banks, required: true },
            { name: "chequeNo", label: t("f.chequeNo"), required: true, showIf: { field: "method", values: ["CHEQUE"] }, dir: "ltr" },
            { name: "chequeDueDate", label: t("f.chequeDate"), type: "date", showIf: { field: "method", values: ["CHEQUE"] } },
            { name: "reference", label: t("f.reference"), dir: "ltr" },
            { name: "notes", label: t("f.notes"), type: "textarea" },
          ]}
        />
      </Section>
    </>
  );
}
