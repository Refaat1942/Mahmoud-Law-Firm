import { getTranslations } from "next-intl/server";
import type { Field } from "@/components/entity-form";

export async function roleFields(): Promise<Field[]> {
  const t = await getTranslations();
  return [
    { name: "key", label: t("f.key"), required: true, dir: "ltr", help: t("users.roleKeyHelp") },
    { name: "nameAr", label: t("f.nameAr"), required: true },
    { name: "nameEn", label: t("f.nameEn"), required: true, dir: "ltr" },
    { name: "scopeAll", label: t("f.scopeAll"), type: "checkbox", help: t("users.scopeHelp") },
  ];
}
