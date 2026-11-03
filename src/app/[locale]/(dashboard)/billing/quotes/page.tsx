import { getLocale, getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/session";
import { localized } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page";
import { enumOptions } from "@/server/options";
import { quoteScope } from "@/server/billing/queries";
import { BillingNav } from "../nav";

export default async function QuotesPage() {
  const user = await requirePermission("billing");
  const t = await getTranslations();
  const locale = await getLocale();
  const quotes = await prisma.quote.findMany({ where: quoteScope(user), include: { client: true, matter: true }, orderBy: { date: "desc" }, take: 2000 });
  return (
    <>
      <PageHeader
        title={t("nav.billing")}
        actions={
          can(user, "billing", "create") && (
            <Link href="/billing/quotes/new" className={buttonVariants()}>
              <Plus /> {t("billing.newQuote")}
            </Link>
          )
        }
      />
      <BillingNav active="quotes" />
      <DataTable
        exportName="quotes"
        emptyText={t("billing.noQuotes")}
        filters={[{ key: "status", label: t("f.status"), options: await enumOptions("QuoteStatus") }]}
        columns={[
          { key: "number", label: t("f.number"), href: "/billing/quotes/:id" },
          { key: "client", label: t("f.client") },
          { key: "matter", label: t("f.matter"), href: "/cases/:matterId" },
          { key: "date", label: t("f.date"), type: "date" },
          { key: "validUntil", label: t("f.validUntil"), type: "date" },
          { key: "total", label: t("f.total"), type: "money", currencyKey: "currency" },
          { key: "status", label: t("f.status"), type: "badge", enumKey: "QuoteStatus" },
        ]}
        rows={quotes.map((q) => ({
          id: q.id,
          number: q.number,
          client: localized(q.client, locale),
          matter: q.matter?.fileNo ?? "",
          matterId: q.matterId ?? "",
          date: q.date.toISOString(),
          validUntil: q.validUntil?.toISOString() ?? "",
          total: q.total.toString(),
          currency: q.currency,
          status: q.status,
        }))}
      />
    </>
  );
}
