import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/session";
import { isoDate } from "@/lib/deadlines";
import { EntityForm } from "@/components/entity-form";
import { PageHeader, Section } from "@/components/page";
import { createTimeEntry } from "@/server/time/actions";
import { timeFields } from "../fields";

export default async function NewTimePage({ searchParams }: { searchParams: Promise<{ matterId?: string }> }) {
  const user = await requirePermission("time", "create");
  const t = await getTranslations();
  const sp = await searchParams;
  return (
    <>
      <PageHeader title={t("time.new")} />
      <Section>
        <EntityForm
          fields={await timeFields(user)}
          schema="timeEntry"
          action={createTimeEntry}
          defaultValues={{ matterId: sp.matterId, date: isoDate(new Date()), billable: true }}
          redirectTo="/time"
        />
      </Section>
    </>
  );
}
