import { getTranslations } from "next-intl/server";
import type { Field } from "@/components/entity-form";
import { clientOptions, roleOptions } from "@/server/options";

export async function userFields(mode: "create" | "update"): Promise<Field[]> {
  const t = await getTranslations();
  const [roles, clients] = await Promise.all([roleOptions(), clientOptions()]);
  return [
    { name: "nameAr", label: t("f.nameAr"), required: true, dir: "rtl" },
    { name: "nameEn", label: t("f.nameEn"), required: true, dir: "ltr" },
    { name: "email", label: t("f.email"), type: "email", required: true },
    { name: "phone", label: t("f.phone"), type: "tel" },
    { name: "roleId", label: t("f.role"), type: "select", options: roles, required: true },
    { name: "clientId", label: t("f.portalClient"), type: "select", options: clients, help: t("users.portalClientHelp") },
    {
      name: "password",
      label: mode === "create" ? t("f.password") : t("f.newPassword"),
      type: "password",
      required: mode === "create",
      help: mode === "update" ? t("users.passwordHelp") : undefined,
    },
    { name: "isActive", label: t("f.isActive"), type: "checkbox" },
  ];
}
