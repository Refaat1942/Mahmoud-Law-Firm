import { getTranslations } from "next-intl/server";
import type { Field } from "@/components/entity-form";
import type { CurrentUser } from "@/lib/session";
import { accountOptions, bankOptions, clientOptions, matterOptions } from "@/server/options";

export async function expenseFields(user: CurrentUser): Promise<Field[]> {
  const t = await getTranslations();
  const [accounts, banks, matters, clients] = await Promise.all([accountOptions("EXPENSE"), bankOptions(), matterOptions(user, {}), clientOptions()]);
  return [
    { name: "date", label: t("f.date"), type: "date", required: true },
    { name: "accountId", label: t("f.account"), type: "select", options: accounts, required: true },
    { name: "description", label: t("f.description"), required: true, span: 2 },
    { name: "vendor", label: t("f.vendor") },
    { name: "bankAccountId", label: t("accounting.paidFrom"), type: "select", options: banks, required: true },
    { name: "amount", label: t("accounting.netAmount"), type: "money", required: true },
    { name: "vatAmount", label: t("f.vatAmount"), type: "money", help: t("accounting.vatHelp") },
    { name: "matterId", label: t("f.matter"), type: "select", options: matters },
    { name: "clientId", label: t("f.client"), type: "select", options: clients, help: t("accounting.clientHelp") },
    { name: "billable", label: t("f.reimbursable"), type: "checkbox" },
  ];
}
