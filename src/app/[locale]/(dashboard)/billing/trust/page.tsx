import { getLocale, getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/session";
import { trustBalance } from "@/lib/billing";
import { sum } from "@/lib/money";
import { localized } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { DataTable } from "@/components/data-table";
import { Money } from "@/components/format";
import { PageHeader, Section, StatCard } from "@/components/page";
import { enumOptions } from "@/server/options";
import { trustScope } from "@/server/billing/queries";
import { BillingNav } from "../nav";

export default async function TrustPage() {
  const user = await requirePermission("billing");
  const t = await getTranslations();
  const locale = await getLocale();
  const rows = await prisma.trustTransaction.findMany({ where: trustScope(user), include: { client: true, matter: true, invoice: true, bankAccount: true }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] });
  const byClient = new Map<string, { name: string; id: string; movements: typeof rows }>();
  for (const r of rows) {
    const entry = byClient.get(r.clientId) ?? { name: localized(r.client, locale), id: r.clientId, movements: [] };
    entry.movements.push(r);
    byClient.set(r.clientId, entry);
  }
  const balances = [...byClient.values()].map((c) => ({ ...c, balance: trustBalance(c.movements) })).filter((c) => !c.balance.isZero());
  const total = sum(balances.map((b) => b.balance));

  return (
    <>
      <PageHeader
        title={t("nav.billing")}
        actions={
          can(user, "billing", "create") && (
            <Link href="/billing/trust/new" className={buttonVariants()}>
              <Plus /> {t("billing.newTrust")}
            </Link>
          )
        }
      />
      <BillingNav active="trust" />
      <p className="mb-4 text-sm text-muted-foreground">{t("billing.trustHelp")}</p>
      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <StatCard label={t("billing.trustTotal")} value={<Money value={total.toString()} />} hint={t("billing.clientsCount", { count: balances.length })} />
        <Section title={t("billing.trustBalances")} className="lg:col-span-2">
          {balances.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>{t("f.client")}</Th>
                  <Th>{t("f.balance")}</Th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b) => (
                  <tr key={b.id}>
                    <Td>
                      <Link href={`/clients/${b.id}?tab=statement`} className="text-primary hover:underline dark:text-accent">
                        {b.name}
                      </Link>
                    </Td>
                    <Td>
                      <Money value={b.balance.toString()} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Section>
      </div>
      <DataTable
        exportName="trust"
        filters={[{ key: "type", label: t("f.type"), options: await enumOptions("TrustType") }]}
        columns={[
          { key: "date", label: t("f.date"), type: "date" },
          { key: "client", label: t("f.client") },
          { key: "matter", label: t("f.matter"), href: "/cases/:matterId" },
          { key: "type", label: t("f.type"), type: "badge", enumKey: "TrustType" },
          { key: "invoice", label: t("f.invoice"), href: "/billing/invoices/:invoiceId" },
          { key: "bank", label: t("f.bankAccount") },
          { key: "amount", label: t("f.amount"), type: "money" },
          { key: "notes", label: t("f.notes") },
        ]}
        rows={rows.map((r) => ({
          id: r.id,
          date: r.date.toISOString(),
          client: localized(r.client, locale),
          matter: r.matter?.fileNo ?? "",
          matterId: r.matterId ?? "",
          type: r.type,
          invoice: r.invoice?.number ?? "",
          invoiceId: r.invoiceId ?? "",
          bank: localized(r.bankAccount, locale),
          amount: r.amount.toString(),
          notes: r.notes ?? "",
        }))}
      />
    </>
  );
}
