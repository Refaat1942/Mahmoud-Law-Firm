import { getTranslations } from "next-intl/server";
import type { Field } from "@/components/entity-form";
import type { CurrentUser } from "@/lib/session";
import { clientOptions, enumOptions, matterOptions, userOptions } from "@/server/options";

export async function noticeFields(user: CurrentUser): Promise<Field[]> {
  const t = await getTranslations();
  const [dirs, methods, statuses, clients, matters, users] = await Promise.all([
    enumOptions("NoticeDirection"),
    enumOptions("NoticeMethod"),
    enumOptions("NoticeStatus"),
    clientOptions(),
    matterOptions(user, {}),
    userOptions(),
  ]);
  return [
    { name: "title", label: t("f.title"), required: true, span: 2, placeholder: t("notices.titlePlaceholder") },
    { name: "direction", label: t("notices.direction"), type: "select", options: dirs, required: true },
    { name: "status", label: t("notices.delivery"), type: "select", options: statuses, required: true },
    { name: "clientId", label: t("f.client"), type: "select", options: clients, required: true },
    { name: "matterId", label: t("f.matter"), type: "select", options: matters, help: t("notices.matterHelp") },
    { name: "counterparty", label: t("notices.counterparty"), required: true },
    { name: "method", label: t("notices.method"), type: "select", options: methods, required: true },
    { name: "reference", label: t("f.reference"), dir: "ltr", help: t("notices.referenceHelp") },
    { name: "assigneeId", label: t("f.assignee"), type: "select", options: users },
    { name: "sentAt", label: t("notices.sentAt"), type: "date" },
    { name: "servedAt", label: t("notices.servedAt"), type: "date" },
    { name: "graceDays", label: t("notices.graceDays"), type: "number", help: t("notices.graceHelp") },
    { name: "acknowledgedAt", label: t("notices.acknowledgedAt"), type: "date" },
    { name: "notes", label: t("f.notes"), type: "textarea" },
  ];
}
