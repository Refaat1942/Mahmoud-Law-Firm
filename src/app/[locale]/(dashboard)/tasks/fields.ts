import { getTranslations } from "next-intl/server";
import type { Field } from "@/components/entity-form";
import type { CurrentUser } from "@/lib/session";
import { clientOptions, enumOptions, matterOptions, userOptions } from "@/server/options";

export async function taskFields(user: CurrentUser, opts: { parentOptions?: { value: string; label: string }[] } = {}): Promise<Field[]> {
  const t = await getTranslations();
  const [matters, clients, users, priorities, statuses] = await Promise.all([
    matterOptions(user, {}),
    clientOptions(),
    userOptions(),
    enumOptions("Priority"),
    enumOptions("TaskStatus"),
  ]);
  return [
    { name: "title", label: t("f.title"), required: true, span: 2 },
    { name: "matterId", label: t("f.matter"), type: "select", options: matters },
    { name: "clientId", label: t("f.client"), type: "select", options: clients, help: t("tasks.clientHelp") },
    { name: "assigneeId", label: t("f.assignee"), type: "select", options: users },
    { name: "dueDate", label: t("f.dueDate"), type: "date" },
    { name: "priority", label: t("f.priority"), type: "select", options: priorities, required: true },
    { name: "status", label: t("f.status"), type: "select", options: statuses, required: true },
    ...(opts.parentOptions?.length ? [{ name: "parentId", label: t("f.parentTask"), type: "select" as const, options: opts.parentOptions, span: 2 }] : []),
    { name: "description", label: t("f.description"), type: "textarea" },
  ];
}
