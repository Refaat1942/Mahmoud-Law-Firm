import { getTranslations } from "next-intl/server";
import type { Field } from "@/components/entity-form";
import type { CurrentUser } from "@/lib/session";
import { enumOptions, matterOptions, userOptions } from "@/server/options";

export async function filingFields(user: CurrentUser): Promise<Field[]> {
  const t = await getTranslations();
  const [kinds, dirs, statuses, matters, users] = await Promise.all([enumOptions("FilingKind"), enumOptions("FilingDirection"), enumOptions("FilingStatus"), matterOptions(user, {}), userOptions()]);
  return [
    { name: "matterId", label: t("f.matter"), type: "select", options: matters, required: true, span: 2 },
    { name: "kind", label: t("f.type"), type: "select", options: kinds, required: true },
    { name: "direction", label: t("courts.direction"), type: "select", options: dirs, required: true },
    { name: "title", label: t("f.title"), required: true, span: 2, placeholder: t("courts.titlePlaceholder") },
    { name: "reference", label: t("f.reference"), dir: "ltr" },
    { name: "status", label: t("f.status"), type: "select", options: statuses, required: true },
    { name: "submittedAt", label: t("courts.submittedAt"), type: "date" },
    { name: "responseDueAt", label: t("courts.responseDueAt"), type: "date" },
    { name: "followUpAt", label: t("courts.followUpAt"), type: "date", help: t("courts.followUpHelp") },
    { name: "respondedAt", label: t("courts.respondedAt"), type: "date" },
    { name: "assigneeId", label: t("f.assignee"), type: "select", options: users },
    { name: "response", label: t("courts.response"), type: "textarea" },
    { name: "notes", label: t("f.notes"), type: "textarea" },
  ];
}
