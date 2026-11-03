import { getLocale, getTranslations } from "next-intl/server";
import { Lock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/session";
import { naturalBalance } from "@/lib/ledger";
import { localized } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { EntityForm } from "@/components/entity-form";
import { Money } from "@/components/format";
import { PageHeader, Section } from "@/components/page";
import { accountOptions, enumOptions } from "@/server/options";
import { createAccount } from "@/server/accounting/actions";
import { accountTotals } from "@/server/accounting/queries";
import { AccountingNav } from "../nav";

export default async function AccountsPage() {
  const user = await requirePermission("accounting");
  const t = await getTranslations();
  const locale = await getLocale();
  const [accounts, totals] = await Promise.all([prisma.account.findMany({ orderBy: { code: "asc" } }), accountTotals()]);
  const byId = new Map(totals.map((a) => [a.id, a]));
  const depth = (id: string | null, d = 0): number => {
    const a = accounts.find((x) => x.id === id);
    return a?.parentId ? depth(a.parentId, d + 1) : d;
  };

  return (
    <>
      <PageHeader title={t("nav.accounting")} />
      <AccountingNav active="accounts" />
      <div className="grid gap-5 xl:grid-cols-3">
        <Section title={t("accounting.chart")} className="xl:col-span-2">
          <Table>
            <thead>
              <tr>
                <Th>{t("f.code")}</Th>
                <Th>{t("f.name")}</Th>
                <Th>{t("f.accountType")}</Th>
                <Th>{t("f.balance")}</Th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className={a.isActive ? "" : "opacity-50"}>
                  <Td dir="ltr" className="tabular-nums">
                    {a.code}
                  </Td>
                  <Td>
                    <Link href={`/accounting/accounts/${a.id}`} className="text-primary hover:underline dark:text-accent" style={{ paddingInlineStart: `${depth(a.id) * 1.25}rem` }}>
                      {localized(a, locale)}
                    </Link>
                    {a.isSystem && <Lock className="ms-1 inline size-3 text-muted-foreground" aria-label={t("accounting.system")} />}
                  </Td>
                  <Td>
                    <Badge tone="neutral">{t(`enum.AccountType.${a.type}`)}</Badge>
                  </Td>
                  <Td>
                    <Money value={naturalBalance(byId.get(a.id)!).toString()} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>
        {can(user, "accounting", "create") && (
          <Section title={t("accounting.newAccount")}>
            <EntityForm
              schema="account"
              action={createAccount}
              resetOnSuccess
              columns={1}
              defaultValues={{ type: "EXPENSE", isActive: true }}
              fields={[
                { name: "code", label: t("f.code"), required: true, dir: "ltr", help: t("accounting.codeHelp") },
                { name: "nameAr", label: t("f.nameAr"), required: true },
                { name: "nameEn", label: t("f.nameEn"), required: true, dir: "ltr" },
                { name: "type", label: t("f.accountType"), type: "select", options: await enumOptions("AccountType"), required: true },
                { name: "parentId", label: t("f.parentAccount"), type: "select", options: await accountOptions() },
                { name: "isActive", label: t("f.isActive"), type: "checkbox" },
              ]}
            />
          </Section>
        )}
      </div>
    </>
  );
}
