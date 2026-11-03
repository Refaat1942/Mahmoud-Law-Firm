import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { CheckSquare, Square, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { plain } from "@/lib/plain";
import { can, requirePermission } from "@/lib/session";
import { naturalBalance, runningBalance } from "@/lib/ledger";
import { isoDate } from "@/lib/deadlines";
import { localized } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { ActionButton } from "@/components/action-button";
import { EntityForm } from "@/components/entity-form";
import { DateText, Money } from "@/components/format";
import { PageHeader, Section } from "@/components/page";
import { accountOptions, enumOptions } from "@/server/options";
import { deleteAccount, toggleReconciled, updateAccount } from "@/server/accounting/actions";
import { reportRange } from "@/server/accounting/queries";
import { AccountingNav } from "../../nav";

export default async function AccountLedgerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string; to?: string }> }) {
  const user = await requirePermission("accounting");
  const { id } = await params;
  const sp = await searchParams;
  const t = await getTranslations();
  const locale = await getLocale();
  const account = await prisma.account.findUnique({ where: { id }, include: { bank: true } });
  if (!account) notFound();
  const { from, to, toInclusive } = reportRange(sp);
  const [before, lines] = await Promise.all([
    prisma.journalLine.aggregate({ where: { accountId: id, entry: { date: { lt: from } } }, _sum: { debit: true, credit: true } }),
    prisma.journalLine.findMany({ where: { accountId: id, entry: { date: { gte: from, lt: to } } }, include: { entry: true }, orderBy: [{ entry: { date: "asc" } }, { entry: { number: "asc" } }] }),
  ]);
  const opening = naturalBalance({ type: account.type, debit: before._sum.debit ?? 0, credit: before._sum.credit ?? 0 });
  const rows = runningBalance(account.type, opening, lines);
  const closing = rows.at(-1)?.balance ?? opening;
  const canReconcile = !!account.bank && can(user, "accounting", "update");

  return (
    <>
      <PageHeader
        title={`${account.code} — ${localized(account, locale)}`}
        subtitle={t(`enum.AccountType.${account.type}`)}
        actions={
          can(user, "accounting", "delete") &&
          !account.isSystem && (
            <ActionButton variant="destructive" action={deleteAccount.bind(null, id)} confirm={t("common.confirmDelete")} redirectTo="/accounting/accounts">
              <Trash2 /> {t("common.delete")}
            </ActionButton>
          )
        }
      />
      <AccountingNav active={account.bank ? "banks" : "accounts"} />
      <div className="grid gap-5 xl:grid-cols-3">
        <Section title={t("accounting.ledger")} className="xl:col-span-2">
          <form className="no-print mb-4 flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-sm">
              <span>{t("common.from")}</span>
              <Input type="date" name="from" defaultValue={isoDate(from)} className="w-44" />
            </label>
            <label className="space-y-1 text-sm">
              <span>{t("common.to")}</span>
              <Input type="date" name="to" defaultValue={isoDate(toInclusive)} className="w-44" />
            </label>
            <button className={buttonVariants({ variant: "outline" })}>{t("common.apply")}</button>
          </form>
          <Table>
            <thead>
              <tr>
                <Th>{t("f.date")}</Th>
                <Th>{t("f.number")}</Th>
                <Th>{t("f.description")}</Th>
                <Th>{t("f.debit")}</Th>
                <Th>{t("f.credit")}</Th>
                <Th>{t("f.balance")}</Th>
                {canReconcile && <Th>{t("accounting.reconciled")}</Th>}
              </tr>
            </thead>
            <tbody>
              <tr className="bg-muted/40">
                <Td colSpan={5} className="font-medium">
                  {t("accounting.opening")}
                </Td>
                <Td>
                  <Money value={opening.toString()} />
                </Td>
                {canReconcile && <Td />}
              </tr>
              {rows.map((l) => (
                <tr key={l.id}>
                  <Td className="whitespace-nowrap">
                    <DateText value={l.entry.date} />
                  </Td>
                  <Td>
                    <Link href={`/accounting/journal/${l.entryId}`} className="text-primary hover:underline dark:text-accent">
                      {l.entry.number}
                    </Link>
                  </Td>
                  <Td>
                    {l.entry.description}
                    {l.memo && <span className="text-muted-foreground"> · {l.memo}</span>}
                  </Td>
                  <Td>{!l.debit.isZero() && <Money value={l.debit.toString()} />}</Td>
                  <Td>{!l.credit.isZero() && <Money value={l.credit.toString()} />}</Td>
                  <Td>
                    <Money value={l.balance.toString()} />
                  </Td>
                  {canReconcile && (
                    <Td>
                      <ActionButton variant="ghost" size="icon" action={toggleReconciled.bind(null, l.id)} aria-label={t("accounting.reconciled")}>
                        {l.reconciled ? <CheckSquare className="text-success" /> : <Square />}
                      </ActionButton>
                    </Td>
                  )}
                </tr>
              ))}
              <tr className="bg-muted/40 font-semibold">
                <Td colSpan={5}>{t("accounting.closing")}</Td>
                <Td>
                  <Money value={closing.toString()} />
                </Td>
                {canReconcile && <Td />}
              </tr>
            </tbody>
          </Table>
          {canReconcile && <p className="mt-3 text-xs text-muted-foreground">{t("accounting.reconcileHelp")}</p>}
        </Section>
        {can(user, "accounting", "update") && !account.bank && (
          <Section title={t("common.edit")}>
            {account.isSystem && <p className="mb-3 text-xs text-muted-foreground">{t("accounting.systemHelp")}</p>}
            <EntityForm
              schema="account"
              action={updateAccount.bind(null, id)}
              columns={1}
              defaultValues={plain(account)}
              fields={[
                { name: "code", label: t("f.code"), required: true, dir: "ltr" },
                { name: "nameAr", label: t("f.nameAr"), required: true },
                { name: "nameEn", label: t("f.nameEn"), required: true, dir: "ltr" },
                { name: "type", label: t("f.accountType"), type: "select", options: await enumOptions("AccountType"), required: true },
                { name: "parentId", label: t("f.parentAccount"), type: "select", options: (await accountOptions()).filter((o) => o.value !== id) },
                { name: "isActive", label: t("f.isActive"), type: "checkbox" },
              ]}
            />
          </Section>
        )}
      </div>
    </>
  );
}
