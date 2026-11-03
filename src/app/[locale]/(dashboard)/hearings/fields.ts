import { getTranslations } from "next-intl/server";
import type { Field } from "@/components/entity-form";
import type { CurrentUser } from "@/lib/session";
import { courtOptions, matterOptions, userOptions } from "@/server/options";

export async function hearingFields(user: CurrentUser): Promise<Field[]> {
  const t = await getTranslations();
  const [matters, courts, lawyers] = await Promise.all([matterOptions(user, {}), courtOptions(), userOptions()]);
  return [
    { name: "matterId", label: t("f.matter"), type: "select", options: matters, required: true, span: 2 },
    { name: "date", label: t("f.dateTime"), type: "datetime", required: true },
    { name: "courtId", label: t("f.court"), type: "select", options: courts, help: t("hearings.courtDefault") },
    { name: "room", label: t("f.room") },
    { name: "lawyerId", label: t("f.lawyer"), type: "select", options: lawyers },
    { name: "purpose", label: t("f.purpose"), span: 2, help: t("hearings.purposeHelp") },
    { name: "notes", label: t("f.notes"), type: "textarea" },
  ];
}
