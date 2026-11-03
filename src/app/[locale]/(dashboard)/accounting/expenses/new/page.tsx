import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/session";
import { isoDate } from "@/lib/deadlines";
import { EntityForm } from "@/components/entity-form";
import { PageHeader, Section } from "@/components/page";
import { bankOptions } from "@/server/options";
import { createExpense } from "@/server/accounting/actions";
import { expenseFields } from "../fields";

export default async function NewExpensePage({ searchParams }: { searchParams: Promise<{ matterId?: string; clientId?: string }> }) {
  const user = await requirePermission("accounting", "create");
  const t = await getTranslations();
  const sp = await searchParams;
  const banks = await bankOptions();
  return (
    <>
      <PageHeader title={t("accounting.newExpense")} />
      <Section>
        <EntityForm
          fields={await expenseFields(user)}
          schema="expense"
          action={createExpense}
          defaultValues={{ date: isoDate(new Date()), matterId: sp.matterId, clientId: sp.clientId, billable: !!sp.matterId, bankAccountId: banks[0]?.value }}
          redirectTo="/accounting/expenses/:id"
        />
      </Section>
    </>
  );
}
