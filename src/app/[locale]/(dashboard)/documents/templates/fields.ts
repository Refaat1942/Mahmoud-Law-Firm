import { getTranslations } from "next-intl/server";
import type { Field } from "@/components/entity-form";
import { TEMPLATE_PLACEHOLDERS } from "@/lib/templates";
import { enumOptions } from "@/server/options";

export async function templateFields(): Promise<Field[]> {
  const t = await getTranslations();
  return [
    { name: "name", label: t("f.name"), required: true },
    { name: "category", label: t("f.category"), type: "select", options: await enumOptions("DocumentCategory"), required: true },
    { name: "language", label: t("f.language"), type: "select", options: await enumOptions("Language"), required: true },
    { name: "body", label: t("f.body"), type: "textarea", required: true, help: `${t("documents.placeholdersHelp")} ${TEMPLATE_PLACEHOLDERS.map((p) => `{{${p}}}`).join("  ")}` },
  ];
}
