import { getTranslations } from "next-intl/server";
import type { Field } from "@/components/entity-form";
import { enumOptions } from "@/server/options";

export async function clientFields(): Promise<Field[]> {
  const t = await getTranslations();
  const types = await enumOptions("PartyType");
  return [
    { name: "type", label: t("f.clientType"), type: "select", options: types, required: true },
    { name: "nameAr", label: t("f.nameAr"), required: true },
    { name: "nameEn", label: t("f.nameEn"), required: true, dir: "ltr" },
    { name: "emiratesId", label: t("f.emiratesId"), placeholder: "784-XXXX-XXXXXXX-X", dir: "ltr", showIf: { field: "type", values: ["INDIVIDUAL"] } },
    { name: "passportNo", label: t("f.passportNo"), dir: "ltr", showIf: { field: "type", values: ["INDIVIDUAL"] } },
    { name: "nationality", label: t("f.nationality"), showIf: { field: "type", values: ["INDIVIDUAL"] } },
    { name: "tradeLicenseNo", label: t("f.tradeLicenseNo"), dir: "ltr", required: true, showIf: { field: "type", values: ["COMPANY"] } },
    { name: "trn", label: t("f.trn"), dir: "ltr", placeholder: "100XXXXXXXXXXXX" },
    { name: "email", label: t("f.email"), type: "email" },
    { name: "phone", label: t("f.phone"), type: "tel", placeholder: "+971 5X XXX XXXX" },
    { name: "address", label: t("f.address"), span: 2 },
    { name: "notes", label: t("f.notes"), type: "textarea" },
  ];
}

export async function partyFields(): Promise<Field[]> {
  const t = await getTranslations();
  return [
    { name: "type", label: t("f.clientType"), type: "select", options: await enumOptions("PartyType"), required: true },
    { name: "nameAr", label: t("f.nameAr"), required: true },
    { name: "nameEn", label: t("f.nameEn"), dir: "ltr" },
    { name: "idNumber", label: t("f.idNumber"), dir: "ltr" },
    { name: "phone", label: t("f.phone"), type: "tel" },
    { name: "notes", label: t("f.notes"), type: "textarea" },
  ];
}
