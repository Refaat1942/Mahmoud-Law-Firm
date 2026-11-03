import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { matterScope, requirePermission } from "@/lib/session";
import { AGING_BUCKETS, agingReport } from "@/lib/aging";
import { balanceDue } from "@/lib/billing";
import { dec, sum } from "@/lib/money";
import { timeAmount } from "@/lib/time";
import { isoDate } from "@/lib/deadlines";
import { localized } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { DataTable } from "@/components/data-table";
import { Money } from "@/components/format";
import { PrintButton } from "@/components/print-button";
import { PageHeader, Section, StatCard, Tabs } from "@/components/page";
import { reportRange } from "@/server/accounting/queries";
import { COUNTED_PAYMENT } from "@/server/billing/queries";

const TABS = ["cases", "hearings", "time", "revenue", "aging"] as const;

/** Counts rows by a key, sorted by count. */
function countBy<T>(rows: T[], key: (r: T) => string) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function CountTable({ title, rows, label }: { title: string; rows: [string, number][]; label: string }) {
  return (
    <Section title={title}>
      <Table>
        <thead>
          <tr>
            <Th>{label}</Th>
            <Th>#</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, n]) => (
            <tr key={k}>
              <Td>{k || "—"}</Td>
              <Td className="tabular-nums">{n}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Section>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ tab?: string; from?: string; to?: string }> }) {
  const user = await requirePermission("reports");
  const sp = await searchParams;
  const tab = TABS.find((x) => x === sp.tab) ?? "cases";
  const t = await getTranslations();
  const locale = await getLocale();
  const { from, to, toInclusive } = reportRange(sp);
  const scope = matterScope(user);
  const inRange = { gte: from, lt: to };

  let body: React.ReactNode;
  if (tab === "cases") {
    const matters = await prisma.matter.findMany({ where: scope, include: { type: true, responsible: true, court: true } });
    const open = matters.filter((m) => m.status === "OPEN");
    const opened = matters.filter((m) => m.openedAt >= from && m.openedAt < to);
    const closed = matters.filter((m) => m.closedAt && m.closedAt >= from && m.closedAt < to);
    body = (
      <>
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label={t("reports.openCases")} value={open.length} />
          <StatCard label={t("reports.openedInPeriod")} value={opened.length} />
          <StatCard label={t("reports.closedInPeriod")} value={closed.length} />
          <StatCard label={t("reports.won")} value={closed.filter((m) => m.outcome === "WON").length} hint={t("reports.ofClosed", { count: closed.length })} />
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          <CountTable title={t("reports.openByLawyer")} label={t("f.responsible")} rows={countBy(open, (m) => localized(m.responsible, locale))} />
          <CountTable title={t("reports.openByType")} label={t("f.matterType")} rows={countBy(open, (m) => localized(m.type, locale))} />
          <CountTable title={t("reports.openByLevel")} label={t("f.level")} rows={countBy(open, (m) => t(`enum.MatterLevel.${m.level}`))} />
          <CountTable title={t("reports.openByCourt")} label={t("f.court")} rows={countBy(open, (m) => localized(m.court, locale))} />
          <CountTable title={t("reports.closedByOutcome")} label={t("f.outcome")} rows={countBy(closed, (m) => (m.outcome ? t(`enum.MatterOutcome.${m.outcome}`) : ""))} />
        </div>
      </>
    );
  } else if (tab === "hearings") {
    const hearings = await prisma.hearing.findMany({ where: { deletedAt: null, date: inRange, matter: scope }, include: { court: true, lawyer: true } });
    body = (
      <>
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label={t("reports.hearingsInPeriod")} value={hearings.length} />
          {(["HELD", "POSTPONED", "SCHEDULED"] as const).map((s) => (
            <StatCard key={s} label={t(`enum.HearingStatus.${s}`)} value={hearings.filter((h) => h.status === s).length} />
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <CountTable title={t("reports.hearingsByCourt")} label={t("f.court")} rows={countBy(hearings, (h) => localized(h.court, locale))} />
          <CountTable title={t("reports.hearingsByLawyer")} label={t("f.lawyer")} rows={countBy(hearings, (h) => localized(h.lawyer, locale))} />
        </div>
      </>
    );
  } else if (tab === "time") {
    const entries = await prisma.timeEntry.findMany({ where: { deletedAt: null, date: inRange, matter: scope }, include: { user: true } });
    const byUser = new Map<string, { name: string; total: number; billable: number; value: ReturnType<typeof dec> }>();
    for (const e of entries) {
      const row = byUser.get(e.userId) ?? { name: localized(e.user, locale), total: 0, billable: 0, value: dec(0) };
      row.total += e.minutes;
      if (e.billable) {
        row.billable += e.minutes;
        row.value = row.value.plus(timeAmount(e.rate, e.minutes));
      }
      byUser.set(e.userId, row);
    }
    const rows = [...byUser.entries()].map(([id, r]) => ({
      id,
      name: r.name,
      total: r.total,
      billable: r.billable,
      utilization: r.total ? Math.round((r.billable / r.total) * 100) : 0,
      value: r.value.toString(),
    }));
    body = (
      <DataTable
        exportName="time-by-lawyer"
        columns={[
          { key: "name", label: t("f.lawyer") },
          { key: "total", label: t("time.totalHours"), type: "hours" },
          { key: "billable", label: t("time.billableHours"), type: "hours" },
          { key: "utilization", label: t("reports.utilization"), type: "number" },
          { key: "value", label: t("reports.billableValue"), type: "money" },
        ]}
        rows={rows}
      />
    );
  } else if (tab === "revenue") {
    const [invoices, payments] = await Promise.all([
      prisma.invoice.findMany({ where: { deletedAt: null, status: { notIn: ["DRAFT", "CANCELLED"] }, issueDate: inRange }, include: { matter: { include: { responsible: true } } } }),
      prisma.payment.findMany({ where: { ...COUNTED_PAYMENT, date: inRange } }),
    ]);
    const month = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const months = [...new Set([...invoices.map((i) => month(i.issueDate)), ...payments.map((p) => month(p.date))])].sort();
    const aed = (i: (typeof invoices)[number]) => dec(i.subtotal).times(i.exchangeRate);
    const byLawyer = countBy(invoices, (i) => localized(i.matter?.responsible, locale)).map(([name]) => [
      name,
      sum(invoices.filter((i) => localized(i.matter?.responsible, locale) === name).map(aed)),
    ] as const);
    body = (
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title={t("reports.byMonth")}>
          <Table>
            <thead>
              <tr>
                <Th>{t("reports.month")}</Th>
                <Th>{t("reports.invoiced")}</Th>
                <Th>{t("reports.collected")}</Th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m}>
                  <Td dir="ltr">{m}</Td>
                  <Td>
                    <Money value={sum(invoices.filter((i) => month(i.issueDate) === m).map(aed)).toString()} />
                  </Td>
                  <Td>
                    <Money value={sum(payments.filter((p) => month(p.date) === m).map((p) => p.amount)).toString()} />
                  </Td>
                </tr>
              ))}
              <tr className="font-bold">
                <Td>{t("common.total")}</Td>
                <Td>
                  <Money value={sum(invoices.map(aed)).toString()} />
                </Td>
                <Td>
                  <Money value={sum(payments.map((p) => p.amount)).toString()} />
                </Td>
              </tr>
            </tbody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">{t("reports.revenueHelp")}</p>
        </Section>
        <Section title={t("reports.byLawyer")}>
          <Table>
            <thead>
              <tr>
                <Th>{t("f.responsible")}</Th>
                <Th>{t("reports.invoiced")}</Th>
              </tr>
            </thead>
            <tbody>
              {byLawyer.map(([name, total]) => (
                <tr key={name}>
                  <Td>{name || "—"}</Td>
                  <Td>
                    <Money value={total.toString()} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>
      </div>
    );
  } else {
    const open = await prisma.invoice.findMany({ where: { deletedAt: null, status: { in: ["ISSUED", "PARTIALLY_PAID"] } }, include: { client: true } });
    const report = agingReport(
      open.map((i) => ({ clientId: i.clientId, due: i.dueDate ?? i.issueDate, balance: balanceDue(i).times(i.exchangeRate) })),
      toInclusive,
    );
    const names = new Map(open.map((i) => [i.clientId, localized(i.client, locale)]));
    body = (
      <DataTable
        exportName="receivables-aging"
        pageSize={100}
        columns={[
          { key: "client", label: t("f.client"), href: "/clients/:id?tab=statement" },
          ...AGING_BUCKETS.map((b) => ({ key: b, label: t(`reports.aging.${b}`), type: "money" as const })),
          { key: "total", label: t("common.total"), type: "money" },
        ]}
        rows={[
          ...[...report.byClient.entries()].map(([id, c]) => ({ id, client: names.get(id) ?? id, ...Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.toString()])) })),
          { id: "__total", client: t("common.total"), ...Object.fromEntries(Object.entries(report.totals).map(([k, v]) => [k, v.toString()])) },
        ]}
      />
    );
  }

  return (
    <>
      <PageHeader title={t("nav.reports")} actions={<PrintButton />} />
      <Tabs base="/reports" active={tab} tabs={TABS.map((key) => ({ key, label: t(`reports.tabs.${key}`) }))} />
      <form className="no-print mb-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="tab" value={tab} />
        {tab !== "aging" && (
          <label className="space-y-1 text-sm">
            <span>{t("common.from")}</span>
            <Input type="date" name="from" defaultValue={isoDate(from)} className="w-44" />
          </label>
        )}
        <label className="space-y-1 text-sm">
          <span>{tab === "aging" ? t("accounting.asOf") : t("common.to")}</span>
          <Input type="date" name="to" defaultValue={isoDate(toInclusive)} className="w-44" />
        </label>
        <button className={buttonVariants({ variant: "outline" })}>{t("common.apply")}</button>
      </form>
      {body}
    </>
  );
}
