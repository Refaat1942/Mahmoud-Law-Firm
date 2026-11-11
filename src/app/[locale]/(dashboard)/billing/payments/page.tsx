import { getLocale, getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/session";
import { localized } from "@/lib/utils";
import { sum } from "@/lib/money";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { ActionButton } from "@/components/action-button";
import { DataTable } from "@/components/data-table";
import { DateText, Money } from "@/components/format";
import { PageHeader, Section } from "@/components/page";
import { enumOptions } from "@/server/options";
import { setChequeStatus } from "@/server/billing/actions";
import { paymentScope } from "@/server/billing/queries";
import { BillingNav } from "../nav";

export default async function PaymentsPage() {
  const user = await requirePermission("billing");
  const t = await getTranslations();
  const locale = await getLocale();
  const payments = await prisma.payment.findMany({
    where: paymentScope(user),
    include: { client: true, invoice: true, bankAccount: true, allocations: { include: { invoice: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 3000,
  });
  const pendingCheques = payments.filter((p) => p.chequeStatus === "PENDING").sort((a, b) => +(a.chequeDueDate ?? a.date) - +(b.chequeDueDate ?? b.date));
  const canUpdate = can(user, "billing", "update");

  return (
    <>
      <PageHeader
        title={t("nav.billing")}
        actions={
          can(user, "billing", "create") && (
            <Link href="/billing/payments/new" className={buttonVariants()}>
              <Plus /> {t("billing.recordPayment")}
            </Link>
          )
        }
      />
      <BillingNav active="payments" />
      {pendingCheques.length > 0 && (
        <Section title={t("billing.pendingCheques")} className="mb-5">
          <Table>
            <thead>
              <tr>
                <Th>{t("f.chequeNo")}</Th>
                <Th>{t("f.chequeDate")}</Th>
                <Th>{t("f.client")}</Th>
                <Th>{t("f.amount")}</Th>
                {canUpdate && <Th />}
              </tr>
            </thead>
            <tbody>
              {pendingCheques.map((p) => (
                <tr key={p.id}>
                  <Td dir="ltr">{p.chequeNo}</Td>
                  <Td>
                    <DateText value={p.chequeDueDate ?? p.date} />
                  </Td>
                  <Td>{localized(p.client, locale)}</Td>
                  <Td>
                    <Money value={p.amount.toString()} />
                  </Td>
                  {canUpdate && (
                    <Td className="space-x-2 whitespace-nowrap rtl:space-x-reverse">
                      <ActionButton size="sm" action={setChequeStatus.bind(null, p.id)} payload={{ status: "CLEARED" }}>
                        {t("enum.ChequeStatus.CLEARED")}
                      </ActionButton>
                      <ActionButton size="sm" variant="destructive" action={setChequeStatus.bind(null, p.id)} payload={{ status: "BOUNCED" }} confirm={t("billing.confirmBounce")}>
                        {t("enum.ChequeStatus.BOUNCED")}
                      </ActionButton>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>
      )}
      <DataTable
        exportName="payments"
        emptyText={t("billing.noPayments")}
        filters={[
          { key: "method", label: t("f.method"), options: await enumOptions("PaymentMethod") },
          { key: "client", label: t("f.client"), options: [...new Set(payments.map((p) => localized(p.client, locale)))].map((v) => ({ value: v, label: v })) },
        ]}
        columns={[
          { key: "number", label: t("f.number") },
          { key: "date", label: t("f.date"), type: "date" },
          { key: "client", label: t("f.client") },
          { key: "invoice", label: t("f.invoice"), href: "/billing/invoices/:invoiceId" },
          { key: "onAccount", label: t("billing.onAccountLeft"), type: "money", href: "/billing/payments/:id/allocate" },
          { key: "method", label: t("f.method"), type: "badge", enumKey: "PaymentMethod" },
          { key: "bank", label: t("f.bankAccount") },
          { key: "reference", label: t("f.reference") },
          { key: "amount", label: t("f.amount"), type: "money" },
          { key: "chequeStatus", label: t("f.chequeStatus"), type: "badge", enumKey: "ChequeStatus" },
        ]}
        rows={payments.map((p) => ({
          id: p.id,
          number: p.number,
          date: p.date.toISOString(),
          client: localized(p.client, locale),
          // A receipt split over several invoices lists all their numbers.
          invoice: p.allocations.length ? p.allocations.map((a) => a.invoice.number).join("، ") : t("billing.onAccount"),
          onAccount: p.chequeStatus === "BOUNCED" ? "0" : p.amount.minus(sum(p.allocations.map((a) => a.amount))).toString(),
          invoiceId: p.invoiceId ?? "",
          method: p.method,
          bank: localized(p.bankAccount, locale),
          reference: p.chequeNo ?? p.reference ?? "",
          amount: p.amount.toString(),
          chequeStatus: p.chequeStatus ?? "",
        }))}
      />
    </>
  );
}
