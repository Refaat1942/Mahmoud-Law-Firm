import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/session";
import { isoDate } from "@/lib/deadlines";
import { EntityForm } from "@/components/entity-form";
import { PageHeader, Section } from "@/components/page";
import { createFiling } from "@/server/courts/actions";
import { filingFields } from "../fields";

export default async function NewFilingPage({ searchParams }: { searchParams: Promise<{ matterId?: string; kind?: string }> }) {
  const user = await requirePermission("matters", "create");
  const t = await getTranslations();
  const sp = await searchParams;
  return (
    <>
      <PageHeader title={t("courts.newFiling")} />
      <Section>
        <EntityForm
          fields={await filingFields(user)}
          schema="filing"
          action={createFiling}
          defaultValues={{ matterId: sp.matterId, kind: sp.kind === "COMMUNICATION" ? "COMMUNICATION" : "REQUEST", direction: "SUBMITTED", status: "PENDING", submittedAt: isoDate(new Date()), assigneeId: user.id }}
          redirectTo="/court-filings/:id"
        />
      </Section>
    </>
  );
}
