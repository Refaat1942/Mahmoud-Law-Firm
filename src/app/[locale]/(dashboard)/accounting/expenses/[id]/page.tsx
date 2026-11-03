import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { plain } from "@/lib/plain";
import { can, requirePermission } from "@/lib/session";
import { localized, localizedTitle } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { ActionButton } from "@/components/action-button";
import { EntityForm } from "@/components/entity-form";
import { DateText, Money } from "@/components/format";
import { DetailList, PageHeader, Section } from "@/components/page";
import { deleteExpense, updateExpense } from "@/server/accounting/actions";
import { expenseFields } from "../fields";

export default async function ExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("accounting");
  const { id } = await params;
  const t = await getTranslations();
  const locale = await getLocale();
  const e = await prisma.expense.findFirst({ where: { id, deletedAt: null }, include: { account: true, matter: true, client: true, bankAccount: true, invoice: true } });
  if (!e) notFound();
  const entry = await prisma.journalEntry.findFirst({ where: { sourceType: "expense", sourceId: id } });
  const locked = !!e.invoiceId;
  return (
    <>
      <PageHeader
        title={`${e.number} — ${e.description}`}
        subtitle={<DateText value={e.date} />}
        actions={
          !locked &&
          can(user, "accounting", "delete") && (
            <ActionButton variant="destructive" action={deleteExpense.bind(null, id)} confirm={t("common.confirmDelete")} redirectTo="/accounting/expenses">
              <Trash2 /> {t("common.delete")}
            </ActionButton>
          )
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title={t("common.details")}>
          <DetailList
            columns={2}
            items={[
              { label: t("f.account"), value: `${e.account.code} — ${localized(e.account, locale)}` },
              { label: t("accounting.paidFrom"), value: localized(e.bankAccount, locale) },
              { label: t("accounting.netAmount"), value: <Money value={e.amount.toString()} /> },
              { label: t("f.vatAmount"), value: <Money value={e.vatAmount.toString()} /> },
              { label: t("f.vendor"), value: e.vendor },
              { label: t("f.matter"), value: e.matter && <Link href={`/cases/${e.matter.id}?tab=finance`} className="text-primary hover:underline dark:text-accent">{e.matter.fileNo} — {localizedTitle(e.matter, locale)}</Link> },
              { label: t("f.client"), value: localized(e.client, locale) },
              { label: t("f.reimbursable"), value: e.billable ? t("common.yes") : t("common.no") },
              { label: t("f.invoice"), value: e.invoice && <Link href={`/billing/invoices/${e.invoice.id}`} className="text-primary hover:underline dark:text-accent">{e.invoice.status === "DRAFT" ? t("billing.draft") : e.invoice.number}</Link> },
              { label: t("accounting.journalEntry"), value: entry && <Link href={`/accounting/journal/${entry.id}`} className="text-primary hover:underline dark:text-accent">{entry.number}</Link> },
            ]}
          />
        </Section>
        {can(user, "accounting", "update") && !locked && (
          <Section title={t("common.edit")}>
            <EntityForm fields={await expenseFields(user)} schema="expense" action={updateExpense.bind(null, id)} defaultValues={plain(e)} />
          </Section>
        )}
        {locked && <p className="text-sm text-muted-foreground">{t("accounting.expenseInvoiced")}</p>}
      </div>
    </>
  );
}
