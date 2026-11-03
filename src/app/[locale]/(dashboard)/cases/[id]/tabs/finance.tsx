import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/session";
import { sum } from "@/lib/money";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { Money } from "@/components/format";
import { Section, StatCard } from "@/components/page";
import type { TabProps } from "./types";

export async function FinanceTab({ matterId, user }: TabProps) {
  const t = await getTranslations();
  const matter = await prisma.matter.findUniqueOrThrow({ where: { id: matterId } });
  const [invoices, expenses] = await Promise.all([
    prisma.invoice.findMany({ where: { matterId, deletedAt: null }, orderBy: { issueDate: "desc" } }),
    prisma.expense.findMany({ where: { matterId, deletedAt: null }, orderBy: { date: "desc" } }),
  ]);
  const issued = invoices.filter((i) => !["DRAFT", "CANCELLED"].includes(i.status));
  const billed = sum(issued.map((i) => i.subtotal.minus(i.creditAmount)));
  const collected = sum(issued.map((i) => i.paidAmount));
  const spent = sum(expenses.map((e) => e.amount));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label={t("cases.billed")} value={<Money value={billed.toString()} />} />
        <StatCard label={t("cases.collected")} value={<Money value={collected.toString()} />} />
        <StatCard label={t("cases.expenses")} value={<Money value={spent.toString()} />} />
        <StatCard label={t("cases.profit")} value={<Money value={billed.minus(spent).toString()} />} />
      </div>
      <Section
        title={t("billing.invoices")}
        actions={
          can(user, "billing", "create") && (
            <Link href={`/billing/invoices/new?clientId=${matter.clientId}&matterId=${matterId}`} className={buttonVariants({ size: "sm" })}>
              <Plus /> {t("billing.newInvoice")}
            </Link>
          )
        }
      >
        <DataTable
          columns={[
            { key: "number", label: t("f.number"), href: "/billing/invoices/:id" },
            { key: "issueDate", label: t("f.issueDate"), type: "date" },
            { key: "total", label: t("f.total"), type: "money", currencyKey: "currency" },
            { key: "paidAmount", label: t("f.paidAmount"), type: "money", currencyKey: "currency" },
            { key: "status", label: t("f.status"), type: "badge", enumKey: "InvoiceStatus" },
          ]}
          rows={invoices.map((i) => ({
            id: i.id,
            number: i.number,
            issueDate: i.issueDate.toISOString(),
            total: i.total.toString(),
            paidAmount: i.paidAmount.toString(),
            currency: i.currency,
            status: i.status,
          }))}
        />
      </Section>
      <Section
        title={t("cases.expenses")}
        actions={
          can(user, "accounting", "create") && (
            <Link href={`/accounting/expenses/new?matterId=${matterId}&clientId=${matter.clientId}`} className={buttonVariants({ size: "sm" })}>
              <Plus /> {t("accounting.newExpense")}
            </Link>
          )
        }
      >
        <DataTable
          columns={[
            { key: "number", label: t("f.number") },
            { key: "date", label: t("f.date"), type: "date" },
            { key: "description", label: t("f.description") },
            { key: "amount", label: t("f.amount"), type: "money" },
            { key: "billable", label: t("f.billable"), type: "bool" },
            { key: "invoiced", label: t("cases.invoiced"), type: "bool" },
          ]}
          rows={expenses.map((e) => ({
            id: e.id,
            number: e.number,
            date: e.date.toISOString(),
            description: e.description,
            amount: e.amount.toString(),
            billable: e.billable,
            invoiced: !!e.invoiceId,
          }))}
        />
      </Section>
    </div>
  );
}
