import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/session";
import { sum } from "@/lib/money";
import { localized } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { ActionButton } from "@/components/action-button";
import { DateText, Money } from "@/components/format";
import { PageHeader, Section } from "@/components/page";
import { deleteJournal } from "@/server/accounting/actions";

const SOURCE_LINK: Record<string, (id: string) => string> = {
  invoice: (id) => `/billing/invoices/${id}`,
  expense: (id) => `/accounting/expenses/${id}`,
  payroll: (id) => `/hr/payroll/${id}`,
};

export default async function JournalEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("accounting");
  const { id } = await params;
  const t = await getTranslations();
  const locale = await getLocale();
  const e = await prisma.journalEntry.findUnique({ where: { id }, include: { lines: { include: { account: true } } } });
  if (!e) notFound();
  const source = e.sourceType ?? "manual";
  const link = e.sourceId && SOURCE_LINK[source]?.(e.sourceId);
  return (
    <>
      <PageHeader
        title={`${e.number} — ${e.description}`}
        subtitle={
          <span className="flex items-center gap-2">
            <DateText value={e.date} />
            <Badge tone={source === "manual" ? "neutral" : "info"}>{t(`accounting.sources.${source}`)}</Badge>
            {link && (
              <Link href={link} className="text-primary hover:underline dark:text-accent">
                {t("accounting.viewSource")}
              </Link>
            )}
          </span>
        }
        actions={
          source === "manual" &&
          can(user, "accounting", "delete") && (
            <ActionButton variant="destructive" action={deleteJournal.bind(null, id)} confirm={t("common.confirmDelete")} redirectTo="/accounting/journal">
              <Trash2 /> {t("common.delete")}
            </ActionButton>
          )
        }
      />
      <Section>
        <Table>
          <thead>
            <tr>
              <Th>{t("f.account")}</Th>
              <Th>{t("f.memo")}</Th>
              <Th>{t("f.debit")}</Th>
              <Th>{t("f.credit")}</Th>
            </tr>
          </thead>
          <tbody>
            {e.lines.map((l) => (
              <tr key={l.id}>
                <Td>
                  <Link href={`/accounting/accounts/${l.accountId}`} className="text-primary hover:underline dark:text-accent">
                    {l.account.code} — {localized(l.account, locale)}
                  </Link>
                </Td>
                <Td>{l.memo}</Td>
                <Td>{!l.debit.isZero() && <Money value={l.debit.toString()} />}</Td>
                <Td>{!l.credit.isZero() && <Money value={l.credit.toString()} />}</Td>
              </tr>
            ))}
            <tr className="font-semibold">
              <Td colSpan={2}>{t("common.total")}</Td>
              <Td>
                <Money value={sum(e.lines.map((l) => l.debit)).toString()} />
              </Td>
              <Td>
                <Money value={sum(e.lines.map((l) => l.credit)).toString()} />
              </Td>
            </tr>
          </tbody>
        </Table>
        {source !== "manual" && <p className="mt-3 text-xs text-muted-foreground">{t("accounting.autoHelp")}</p>}
      </Section>
    </>
  );
}
