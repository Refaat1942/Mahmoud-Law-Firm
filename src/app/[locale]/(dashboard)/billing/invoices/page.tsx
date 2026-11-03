import { getLocale, getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/session";
import { balanceDue } from "@/lib/billing";
import { sum } from "@/lib/money";
import { localized, startOfDay } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { Money } from "@/components/format";
import { PageHeader, StatCard } from "@/components/page";
import { enumOptions } from "@/server/options";
import { COUNTED_PAYMENT, invoiceScope } from "@/server/billing/queries";
import { BillingNav } from "../nav";

export default async function InvoicesPage() {
  const user = await requirePermission("billing");
  const t = await getTranslations();
  const locale = await getLocale();
  const today = startOfDay();
  const invoices = await prisma.invoice.findMany({
    where: invoiceScope(user),
    include: { client: true, matter: true },
    orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
    take: 3000,
  });
  const open = invoices.filter((i) => i.status === "ISSUED" || i.status === "PARTIALLY_PAID");
  const aed = (rows: typeof invoices) => sum(rows.filter((i) => i.currency === "AED").map((i) => balanceDue(i))).toString();
  const overdue = open.filter((i) => i.dueDate && i.dueDate < today);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const collected = await prisma.payment.aggregate({ where: { ...COUNTED_PAYMENT, date: { gte: monthStart } }, _sum: { amount: true } });

  const rows = invoices.map((i) => ({
    id: i.id,
    number: i.status === "DRAFT" ? t("billing.draft") : i.number,
    client: localized(i.client, locale),
    matter: i.matter?.fileNo ?? "",
    matterId: i.matterId ?? "",
    issueDate: i.issueDate.toISOString(),
    dueDate: i.dueDate?.toISOString() ?? "",
    total: i.total.toString(),
    balance: balanceDue(i).toString(),
    currency: i.currency,
    status: i.status,
  }));

  return (
    <>
      <PageHeader
        title={t("nav.billing")}
        actions={
          can(user, "billing", "create") && (
            <Link href="/billing/invoices/new" className={buttonVariants()}>
              <Plus /> {t("billing.newInvoice")}
            </Link>
          )
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("billing.receivable")} value={<Money value={aed(open)} />} hint={t("billing.openCount", { count: open.length })} />
        <StatCard label={t("billing.overdue")} value={<Money value={aed(overdue)} />} hint={t("billing.openCount", { count: overdue.length })} />
        <StatCard label={t("billing.collectedMonth")} value={<Money value={(collected._sum.amount ?? 0).toString()} />} />
        <StatCard label={t("billing.drafts")} value={invoices.filter((i) => i.status === "DRAFT").length} />
      </div>
      <BillingNav active="invoices" />
      <DataTable
        exportName="invoices"
        emptyText={t("billing.noInvoices")}
        filters={[
          { key: "status", label: t("f.status"), options: await enumOptions("InvoiceStatus") },
          { key: "client", label: t("f.client"), options: [...new Set(rows.map((r) => r.client))].map((v) => ({ value: v, label: v })) },
        ]}
        columns={[
          { key: "number", label: t("f.number"), href: "/billing/invoices/:id" },
          { key: "client", label: t("f.client") },
          { key: "matter", label: t("f.matter"), href: "/cases/:matterId" },
          { key: "issueDate", label: t("f.issueDate"), type: "date" },
          { key: "dueDate", label: t("f.dueDate"), type: "date" },
          { key: "total", label: t("f.total"), type: "money", currencyKey: "currency" },
          { key: "balance", label: t("billing.balance"), type: "money", currencyKey: "currency" },
          { key: "status", label: t("f.status"), type: "badge", enumKey: "InvoiceStatus" },
        ]}
        rows={rows}
      />
    </>
  );
}
