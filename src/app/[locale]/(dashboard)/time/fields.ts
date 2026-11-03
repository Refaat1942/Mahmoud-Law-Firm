import { getTranslations } from "next-intl/server";
import type { Field } from "@/components/entity-form";
import type { CurrentUser } from "@/lib/session";
import { matterOptions } from "@/server/options";

export async function timeFields(user: CurrentUser): Promise<Field[]> {
  const t = await getTranslations();
  return [
    { name: "matterId", label: t("f.matter"), type: "select", options: await matterOptions(user, {}), required: true, span: 2 },
    { name: "date", label: t("f.date"), type: "date", required: true },
    { name: "hours", label: t("f.hours"), type: "number", required: true, help: t("time.hoursHelp") },
    { name: "description", label: t("f.description"), type: "textarea", required: true },
    { name: "billable", label: t("f.billable"), type: "checkbox" },
  ];
}
