import { getTranslations } from "next-intl/server";
import type { Field } from "@/components/entity-form";
import type { CurrentUser } from "@/lib/session";
import { clientOptions, enumOptions, matterOptions } from "@/server/options";

export async function documentFields(user: CurrentUser, { upload }: { upload: boolean }): Promise<Field[]> {
  const t = await getTranslations();
  const [matters, clients, categories] = await Promise.all([matterOptions(user, {}), clientOptions(), enumOptions("DocumentCategory")]);
  return [
    ...(upload ? [{ name: "file", label: t("f.file"), type: "file" as const, required: true, span: 2, help: t("documents.maxSize") }] : []),
    { name: "name", label: t("f.name"), required: !upload, help: upload ? t("documents.nameHelp") : undefined, span: 2 },
    { name: "matterId", label: t("f.matter"), type: "select", options: matters },
    { name: "clientId", label: t("f.client"), type: "select", options: clients, help: t("documents.clientHelp") },
    { name: "category", label: t("f.category"), type: "select", options: categories, required: true },
    { name: "folder", label: t("f.folder"), placeholder: "/", help: t("documents.folderHelp"), dir: "ltr" },
    { name: "tags", label: t("f.tags"), type: "tags", help: t("documents.tagsHelp") },
    { name: "visibleToClient", label: t("f.visibleToClient"), type: "checkbox" },
  ];
}
