import { getTranslations } from "next-intl/server";
import type { Field } from "@/components/entity-form";
import type { CurrentUser } from "@/lib/session";
import { clientOptions, courtOptions, enumOptions, matterOptions, matterTypeOptions, userOptions } from "@/server/options";

export async function matterFields(user: CurrentUser): Promise<Field[]> {
  const t = await getTranslations();
  const [clients, types, levels, courts, statuses, outcomes, lawyers, matters] = await Promise.all([
    clientOptions(),
    matterTypeOptions(),
    enumOptions("MatterLevel"),
    courtOptions(),
    enumOptions("MatterStatus"),
    enumOptions("MatterOutcome"),
    userOptions(),
    matterOptions(user),
  ]);
  return [
    { name: "titleAr", label: t("f.titleAr"), required: true, span: 2 },
    { name: "titleEn", label: t("f.titleEn"), dir: "ltr" },
    { name: "clientId", label: t("f.client"), type: "select", options: clients, required: true },
    { name: "clientRole", label: t("f.clientRole"), placeholder: t("cases.clientRolePlaceholder") },
    { name: "typeId", label: t("f.matterType"), type: "select", options: types },
    { name: "level", label: t("f.level"), type: "select", options: levels, required: true },
    { name: "courtId", label: t("f.court"), type: "select", options: courts },
    { name: "courtCaseNo", label: t("f.courtCaseNo"), dir: "ltr", placeholder: "2026/123" },
    { name: "responsibleId", label: t("f.responsible"), type: "select", options: lawyers },
    { name: "status", label: t("f.status"), type: "select", options: statuses, required: true },
    { name: "outcome", label: t("f.outcome"), type: "select", options: outcomes, showIf: { field: "status", values: ["CLOSED"] } },
    { name: "stage", label: t("f.stage") },
    { name: "claimAmount", label: t("f.claimAmount"), type: "money" },
    { name: "openedAt", label: t("f.openedAt"), type: "date", required: true },
    { name: "closedAt", label: t("f.closedAt"), type: "date", showIf: { field: "status", values: ["CLOSED"] } },
    { name: "parentId", label: t("f.parentMatter"), type: "select", options: matters, help: t("cases.parentHelp") },
    { name: "description", label: t("f.description"), type: "textarea" },
  ];
}
