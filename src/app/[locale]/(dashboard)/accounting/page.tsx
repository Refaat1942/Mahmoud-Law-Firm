import { getLocale, getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/session";
import { ACC } from "@/lib/journal";
import { naturalBalance, profitAndLoss } from "@/lib/ledger";
import { localized } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { Money } from "@/components/format";
import { PageHeader, Section, StatCard } from "@/components/page";
import { accountTotals } from "@/server/accounting/queries";
import { AccountingNav } from "./nav";

export default async function AccountingPage() {
  const user = await requirePermission("accounting");
  const t = await getTranslations();
  const locale = await getLocale();
  const now = new Date();
  const [all, ytd, banks] = await Promise.all([
    accountTotals(),
    accountTotals({ from: new Date(now.getFullYear(), 0, 1) }),
    prisma.bankAccount.findMany({ include: { account: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const bal = (code: string) => {
    const a = all.find((x) => x.code === code);
    return a ? naturalBalance(a) : null;
  };
  const pl = profitAndLoss(ytd);
  const byId = new Map(all.map((a) => [a.id, a]));

  return (
    <>
      <PageHeader
        title={t("nav.accounting")}
        actions={
          can(user, "accounting", "create") && (
            <>
              <Link href="/accounting/journal/new" className={buttonVariants({ variant: "outline" })}>
                <Plus /> {t("accounting.newJournal")}
              </Link>
              <Link href="/accounting/expenses/new" className={buttonVariants()}>
                <Plus /> {t("accounting.newExpense")}
              </Link>
            </>
          )
        }
      />
      <AccountingNav active="overview" />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("accounting.revenueYtd")} value={<Money value={pl.totalRevenue.toString()} />} href="/accounting/reports?tab=pl" />
        <StatCard label={t("accounting.expensesYtd")} value={<Money value={pl.totalExpenses.toString()} />} href="/accounting/reports?tab=pl" />
        <StatCard label={t("accounting.netYtd")} value={<Money value={pl.net.toString()} />} href="/accounting/reports?tab=pl" />
        <StatCard
          label={t("accounting.vatPayable")}
          value={<Money value={(bal(ACC.VAT_OUTPUT) ?? 0).toString()} />}
          hint={t("accounting.vatInput", { amount: (bal(ACC.VAT_INPUT) ?? 0).toFixed(2) })}
          href="/accounting/reports?tab=vat"
        />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title={t("accounting.cashPosition")}>
          <Table>
            <thead>
              <tr>
                <Th>{t("f.bankAccount")}</Th>
                <Th>{t("f.balance")}</Th>
              </tr>
            </thead>
            <tbody>
              {banks.map((b) => (
                <tr key={b.id} className={b.isActive ? "" : "opacity-50"}>
                  <Td>
                    <Link href={`/accounting/accounts/${b.accountId}`} className="text-primary hover:underline dark:text-accent">
                      {localized(b, locale)}
                    </Link>
                  </Td>
                  <Td>
                    <Money value={naturalBalance(byId.get(b.accountId)!).toString()} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>
        <Section title={t("accounting.keyBalances")}>
          <Table>
            <tbody>
              {[ACC.RECEIVABLE, ACC.TRUST_LIABILITY, ACC.SALARIES_PAYABLE].map((code) => {
                const a = all.find((x) => x.code === code);
                return (
                  a && (
                    <tr key={code}>
                      <Td>
                        <Link href={`/accounting/accounts/${a.id}`} className="text-primary hover:underline dark:text-accent">
                          {a.code} — {localized(a, locale)}
                        </Link>
                      </Td>
                      <Td>
                        <Money value={naturalBalance(a).toString()} />
                      </Td>
                    </tr>
                  )
                );
              })}
            </tbody>
          </Table>
        </Section>
      </div>
    </>
  );
}
