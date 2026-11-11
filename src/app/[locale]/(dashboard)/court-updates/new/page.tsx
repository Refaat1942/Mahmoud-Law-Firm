import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/session";
import { isoDate } from "@/lib/deadlines";
import { EntityForm } from "@/components/entity-form";
import { PageHeader, Section } from "@/components/page";
import { enumOptions, matterOptions } from "@/server/options";
import { createCourtUpdate } from "@/server/courts/actions";

export default async function NewCourtUpdatePage() {
  const user = await requirePermission("matters", "update");
  const t = await getTranslations();
  return (
    <>
      <PageHeader title={t("courts.newUpdate")} subtitle={t("courts.newUpdateHelp")} />
      <Section>
        <EntityForm
          schema="courtUpdate"
          action={createCourtUpdate}
          defaultValues={{ kind: "DECISION", occurredAt: isoDate(new Date()) }}
          redirectTo="/court-updates/:id"
          fields={[
            { name: "courtSystem", label: t("courts.courtSystem"), type: "select", options: await enumOptions("CourtSystem") },
            { name: "courtCaseNo", label: t("f.courtCaseNo"), required: true, help: t("courts.caseNoHelp") },
            { name: "matterId", label: t("f.matter"), type: "select", options: await matterOptions(user, {}), help: t("courts.matterAutoHelp") },
            { name: "kind", label: t("f.type"), type: "select", options: await enumOptions("CourtUpdateKind"), required: true },
            { name: "executionType", label: t("courts.executionType"), type: "select", options: await enumOptions("ExecutionActionType"), showIf: { field: "kind", values: ["EXECUTION"] } },
            { name: "occurredAt", label: t("f.date"), type: "date", required: true },
            { name: "title", label: t("f.title"), required: true, span: 2 },
            { name: "amount", label: t("f.amount"), type: "money", showIf: { field: "kind", values: ["EXECUTION"] } },
            { name: "nextHearingAt", label: t("courts.nextHearing"), type: "datetime", showIf: { field: "kind", values: ["HEARING", "DECISION"] } },
            { name: "details", label: t("f.details"), type: "textarea" },
          ]}
        />
      </Section>
    </>
  );
}
