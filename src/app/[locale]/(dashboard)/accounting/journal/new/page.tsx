import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/session";
import { isoDate } from "@/lib/deadlines";
import { JournalForm } from "@/components/journal-form";
import { PageHeader, Section } from "@/components/page";
import { accountOptions } from "@/server/options";
import { createJournal } from "@/server/accounting/actions";

export default async function NewJournalPage() {
  await requirePermission("accounting", "create");
  const t = await getTranslations();
  return (
    <>
      <PageHeader title={t("accounting.newJournal")} subtitle={t("accounting.journalHelp")} />
      <Section>
        <JournalForm accounts={await accountOptions()} action={createJournal} today={isoDate(new Date())} />
      </Section>
    </>
  );
}
