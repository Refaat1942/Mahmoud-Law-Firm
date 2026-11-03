import { getLocale, getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/session";
import { localized } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page";
import { AccountingNav } from "../nav";

export default async function ExpensesPage() {
  const user = await requirePermission("accounting");
  const t = await getTranslations();
  const locale = await getLocale();
  const expenses = await prisma.expense.findMany({
    where: { deletedAt: null },
    include: { account: true, matter: true, client: true, bankAccount: true, invoice: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 3000,
  });
  const rows = expenses.map((e) => ({
    id: e.id,
    number: e.number,
    date: e.date.toISOString(),
    account: `${e.account.code} — ${localized(e.account, locale)}`,
    description: e.description,
    vendor: e.vendor ?? "",
    matter: e.matter?.fileNo ?? "",
    matterId: e.matterId ?? "",
    client: localized(e.client, locale),
    amount: e.amount.toString(),
    vat: e.vatAmount.toString(),
    billable: e.billable,
    invoice: e.invoice ? (e.invoice.status === "DRAFT" ? t("billing.draft") : e.invoice.number) : "",
    invoiceId: e.invoiceId ?? "",
  }));
  return (
    <>
      <PageHeader
        title={t("nav.accounting")}
        actions={
          can(user, "accounting", "create") && (
            <Link href="/accounting/expenses/new" className={buttonVariants()}>
              <Plus /> {t("accounting.newExpense")}
            </Link>
          )
        }
      />
      <AccountingNav active="expenses" />
      <DataTable
        exportName="expenses"
        emptyText={t("accounting.noExpenses")}
        filters={[
          { key: "account", label: t("f.account"), options: [...new Set(rows.map((r) => r.account))].map((v) => ({ value: v, label: v })) },
          { key: "client", label: t("f.client"), options: [...new Set(rows.map((r) => r.client).filter(Boolean))].map((v) => ({ value: v, label: v })) },
        ]}
        columns={[
          { key: "number", label: t("f.number"), href: "/accounting/expenses/:id" },
          { key: "date", label: t("f.date"), type: "date" },
          { key: "account", label: t("f.account") },
          { key: "description", label: t("f.description") },
          { key: "vendor", label: t("f.vendor") },
          { key: "matter", label: t("f.matter"), href: "/cases/:matterId" },
          { key: "amount", label: t("accounting.netAmount"), type: "money" },
          { key: "vat", label: t("f.vatAmount"), type: "money" },
          { key: "billable", label: t("f.reimbursable"), type: "bool" },
          { key: "invoice", label: t("f.invoice"), href: "/billing/invoices/:invoiceId" },
        ]}
        rows={rows}
      />
    </>
  );
}
