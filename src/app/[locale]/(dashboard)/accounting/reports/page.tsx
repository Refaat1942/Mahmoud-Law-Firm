import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { ACC } from "@/lib/journal";
import { sum } from "@/lib/money";
import { balanceSheet, naturalBalance, profitAndLoss, trialBalance, vatReturn, type AccountTotals } from "@/lib/ledger";
import { getOffice } from "@/lib/settings";
import { isoDate } from "@/lib/deadlines";
import { localized } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { DateText, Money } from "@/components/format";
import { PrintButton } from "@/components/print-button";
import { PageHeader, Section, Tabs } from "@/components/page";
import { accountTotals, reportRange } from "@/server/accounting/queries";
import { AccountingNav } from "../nav";

const REPORTS = ["trial", "pl", "bs", "vat"] as const;
type Report = (typeof REPORTS)[number];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ tab?: string; report?: string; from?: string; to?: string }> }) {
  await requirePermission("accounting");
  const sp = await searchParams;
  const t = await getTranslations();
  const locale = await getLocale();
  // The section tabs link with ?tab=; ?report= is kept for links from the overview.
  const report: Report = REPORTS.find((r) => r === (sp.tab ?? sp.report)) ?? "trial";
  const { from, to, toInclusive } = reportRange(sp);
  const office = await getOffice();
  // Balance-sheet style reports are cumulative to the end date; P&L and VAT cover the period.
  const cumulative = report === "trial" || report === "bs";
  const totals = await accountTotals(cumulative ? { to } : { from, to });
  const name = (a: AccountTotals) => (
    <Link href={`/accounting/accounts/${a.id}?from=${isoDate(from)}&to=${isoDate(toInclusive)}`} className="hover:underline">
      {a.code} — {localized(a, locale)}
    </Link>
  );

  let body: React.ReactNode;
  if (report === "trial") {
    const tb = trialBalance(totals);
    body = (
      <Table>
        <thead>
          <tr>
            <Th>{t("f.account")}</Th>
            <Th>{t("f.debit")}</Th>
            <Th>{t("f.credit")}</Th>
          </tr>
        </thead>
        <tbody>
          {tb.rows.map((r) => (
            <tr key={r.id}>
              <Td>{name(r)}</Td>
              <Td>{!r.debit.isZero() && <Money value={r.debit.toString()} />}</Td>
              <Td>{!r.credit.isZero() && <Money value={r.credit.toString()} />}</Td>
            </tr>
          ))}
          <tr className="font-bold">
            <Td>
              {t("common.total")} {tb.balanced ? <Badge tone="success">{t("accounting.balanced")}</Badge> : <Badge tone="danger">{t("accounting.unbalancedBadge")}</Badge>}
            </Td>
            <Td>
              <Money value={tb.debit.toString()} />
            </Td>
            <Td>
              <Money value={tb.credit.toString()} />
            </Td>
          </tr>
        </tbody>
      </Table>
    );
  } else if (report === "pl") {
    const pl = profitAndLoss(totals);
    const block = (title: string, rows: (AccountTotals & { amount: { toString(): string } })[], total: { toString(): string }) => (
      <>
        <tr className="bg-muted/40">
          <Td colSpan={2} className="font-semibold">
            {title}
          </Td>
        </tr>
        {rows.map((r) => (
          <tr key={r.id}>
            <Td className="ps-6">{name(r)}</Td>
            <Td>
              <Money value={r.amount.toString()} />
            </Td>
          </tr>
        ))}
        <tr className="font-semibold">
          <Td>{t("accounting.totalOf", { name: title })}</Td>
          <Td>
            <Money value={total.toString()} />
          </Td>
        </tr>
      </>
    );
    body = (
      <Table>
        <tbody>
          {block(t("enum.AccountType.REVENUE"), pl.revenue, pl.totalRevenue)}
          {block(t("enum.AccountType.EXPENSE"), pl.expenses, pl.totalExpenses)}
          <tr className="border-t-2 text-base font-bold">
            <Td>{pl.net.isNegative() ? t("accounting.netLoss") : t("accounting.netProfit")}</Td>
            <Td>
              <Money value={pl.net.toString()} />
            </Td>
          </tr>
        </tbody>
      </Table>
    );
  } else if (report === "bs") {
    const bs = balanceSheet(totals);
    const block = (title: string, rows: (AccountTotals & { amount: { toString(): string } })[], total: { toString(): string }, extra?: React.ReactNode) => (
      <>
        <tr className="bg-muted/40">
          <Td colSpan={2} className="font-semibold">
            {title}
          </Td>
        </tr>
        {rows.map((r) => (
          <tr key={r.id}>
            <Td className="ps-6">{name(r)}</Td>
            <Td>
              <Money value={r.amount.toString()} />
            </Td>
          </tr>
        ))}
        {extra}
        <tr className="font-semibold">
          <Td>{t("accounting.totalOf", { name: title })}</Td>
          <Td>
            <Money value={total.toString()} />
          </Td>
        </tr>
      </>
    );
    body = (
      <Table>
        <tbody>
          {block(t("accounting.assets"), bs.assets, bs.totalAssets)}
          {block(t("accounting.liabilities"), bs.liabilities, bs.totalLiabilities)}
          {block(
            t("accounting.equity"),
            bs.equity,
            bs.totalEquity,
            <tr>
              <Td className="ps-6">{t("accounting.currentEarnings")}</Td>
              <Td>
                <Money value={bs.earnings.toString()} />
              </Td>
            </tr>,
          )}
          <tr className="border-t-2 font-bold">
            <Td>
              {t("accounting.liabilitiesAndEquity")} {bs.balanced ? <Badge tone="success">{t("accounting.balanced")}</Badge> : <Badge tone="danger">{t("accounting.unbalancedBadge")}</Badge>}
            </Td>
            <Td>
              <Money value={bs.totalLiabilities.plus(bs.totalEquity).toString()} />
            </Td>
          </tr>
        </tbody>
      </Table>
    );
  } else {
    const get = (code: string) => totals.find((a) => a.code === code) ?? { debit: 0, credit: 0, type: "ASSET" as const };
    const sales = [ACC.FEES_REVENUE, ACC.REIMBURSED_REVENUE].map((c) => totals.find((a) => a.code === c)).filter(Boolean) as AccountTotals[];
    const expenseAccounts = totals.filter((a) => a.type === "EXPENSE");
    const v = vatReturn({
      outputVat: get(ACC.VAT_OUTPUT),
      inputVat: get(ACC.VAT_INPUT),
      standardRatedSales: sum(sales.map(naturalBalance)),
      expenses: sum(expenseAccounts.map(naturalBalance)),
    });
    const issuedVat = await prisma.invoice.aggregate({ where: { deletedAt: null, status: { notIn: ["DRAFT", "CANCELLED"] }, issueDate: { gte: from, lt: to } }, _count: true });
    body = (
      <>
        <Table>
          <thead>
            <tr>
              <Th>{t("accounting.vatBox")}</Th>
              <Th>{t("f.amount")}</Th>
              <Th>{t("f.vatAmount")}</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td>{t("accounting.vatSales", { rate: office.vatRate })}</Td>
              <Td>
                <Money value={v.standardRatedSales.toString()} />
              </Td>
              <Td>
                <Money value={v.outputVat.toString()} />
              </Td>
            </tr>
            <tr>
              <Td>{t("accounting.vatExpenses")}</Td>
              <Td>
                <Money value={v.expenses.toString()} />
              </Td>
              <Td>
                <Money value={v.inputVat.toString()} />
              </Td>
            </tr>
            <tr className="border-t-2 font-bold">
              <Td colSpan={2}>{v.netPayable.isNegative() ? t("accounting.vatRefundable") : t("accounting.vatNetPayable")}</Td>
              <Td>
                <Money value={v.netPayable.abs().toString()} />
              </Td>
            </tr>
          </tbody>
        </Table>
        <p className="mt-3 text-xs text-muted-foreground">
          {t("accounting.vatNote", { count: issuedVat._count })} {office.trn ? `TRN ${office.trn}` : t("accounting.noTrn")}
        </p>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("nav.accounting")} actions={<PrintButton />} />
      <AccountingNav active="reports" />
      <Tabs base="/accounting/reports" active={report} tabs={REPORTS.map((r) => ({ key: r, label: t(`accounting.reports.${r}`) }))} />
      <Section>
        <form className="no-print mb-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="tab" value={report} />
          {!cumulative && (
            <label className="space-y-1 text-sm">
              <span>{t("common.from")}</span>
              <Input type="date" name="from" defaultValue={isoDate(from)} className="w-44" />
            </label>
          )}
          <label className="space-y-1 text-sm">
            <span>{cumulative ? t("accounting.asOf") : t("common.to")}</span>
            <Input type="date" name="to" defaultValue={isoDate(toInclusive)} className="w-44" />
          </label>
          <button className={buttonVariants({ variant: "outline" })}>{t("common.apply")}</button>
        </form>
        <h2 className="mb-3 text-base font-semibold">
          {t(`accounting.reports.${report}`)} —{" "}
          {cumulative ? (
            <>
              {t("accounting.asOf")} <DateText value={toInclusive} />
            </>
          ) : (
            <>
              <DateText value={from} /> – <DateText value={toInclusive} />
            </>
          )}
        </h2>
        {body}
      </Section>
    </>
  );
}
