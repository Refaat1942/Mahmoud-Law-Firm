import { getLocale, getTranslations } from "next-intl/server";
import { Power } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/session";
import { naturalBalance } from "@/lib/ledger";
import { localized } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { ActionButton } from "@/components/action-button";
import { EntityForm } from "@/components/entity-form";
import { Money } from "@/components/format";
import { PageHeader, Section } from "@/components/page";
import { enumOptions } from "@/server/options";
import { createBankAccount, toggleBankAccount } from "@/server/accounting/actions";
import { accountTotals } from "@/server/accounting/queries";
import { AccountingNav } from "../nav";

export default async function BanksPage() {
  const user = await requirePermission("accounting");
  const t = await getTranslations();
  const locale = await getLocale();
  const [banks, totals] = await Promise.all([prisma.bankAccount.findMany({ include: { account: true }, orderBy: { createdAt: "asc" } }), accountTotals()]);
  const byId = new Map(totals.map((a) => [a.id, a]));
  const unreconciled = await prisma.journalLine.groupBy({ by: ["accountId"], where: { reconciled: false, accountId: { in: banks.map((b) => b.accountId) } }, _count: true });
  const pending = new Map(unreconciled.map((u) => [u.accountId, u._count]));

  return (
    <>
      <PageHeader title={t("nav.accounting")} />
      <AccountingNav active="banks" />
      <div className="grid gap-5 xl:grid-cols-3">
        <Section title={t("accounting.sections.banks")} className="xl:col-span-2">
          <Table>
            <thead>
              <tr>
                <Th>{t("f.name")}</Th>
                <Th>{t("f.type")}</Th>
                <Th>{t("f.iban")}</Th>
                <Th>{t("f.balance")}</Th>
                <Th>{t("accounting.toReconcile")}</Th>
                {can(user, "accounting", "update") && <Th />}
              </tr>
            </thead>
            <tbody>
              {banks.map((b) => (
                <tr key={b.id} className={b.isActive ? "" : "opacity-50"}>
                  <Td>
                    <Link href={`/accounting/accounts/${b.accountId}`} className="text-primary hover:underline dark:text-accent">
                      {localized(b, locale)}
                    </Link>
                    <p className="text-xs text-muted-foreground" dir="ltr">
                      {b.account.code}
                      {b.bankName ? ` · ${b.bankName}` : ""}
                    </p>
                  </Td>
                  <Td>
                    <Badge tone="neutral">{t(`enum.BankAccountType.${b.type}`)}</Badge>
                  </Td>
                  <Td dir="ltr" className="text-xs">
                    {b.iban}
                  </Td>
                  <Td>
                    <Money value={naturalBalance(byId.get(b.accountId)!).toString()} currency={b.currency} />
                  </Td>
                  <Td className="tabular-nums">{pending.get(b.accountId) ?? 0}</Td>
                  {can(user, "accounting", "update") && (
                    <Td>
                      <ActionButton variant="ghost" size="icon" action={toggleBankAccount.bind(null, b.id)} aria-label={b.isActive ? t("accounting.deactivate") : t("accounting.activate")} title={b.isActive ? t("accounting.deactivate") : t("accounting.activate")}>
                        <Power />
                      </ActionButton>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>
        {can(user, "accounting", "create") && (
          <Section title={t("accounting.newBank")}>
            <EntityForm
              schema="bankAccount"
              action={createBankAccount}
              resetOnSuccess
              columns={1}
              defaultValues={{ type: "BANK", currency: "AED" }}
              fields={[
                { name: "nameAr", label: t("f.nameAr"), required: true },
                { name: "nameEn", label: t("f.nameEn"), required: true, dir: "ltr" },
                { name: "type", label: t("f.type"), type: "select", options: await enumOptions("BankAccountType"), required: true },
                { name: "bankName", label: t("f.bankName") },
                { name: "iban", label: t("f.iban"), dir: "ltr", placeholder: "AE07 0331 2345 6789 0123 456" },
                { name: "currency", label: t("f.currency"), type: "select", options: await enumOptions("Currency"), required: true },
                { name: "code", label: t("accounting.ledgerCode"), required: true, dir: "ltr", help: t("accounting.bankCodeHelp") },
              ]}
            />
          </Section>
        )}
      </div>
    </>
  );
}
