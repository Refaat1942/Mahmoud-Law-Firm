import { getTranslations } from "next-intl/server";
import type { Field } from "@/components/entity-form";
import type { CurrentUser } from "@/lib/session";
import { getOffice } from "@/lib/settings";
import { clientOptions, enumOptions, matterOptions } from "@/server/options";

export async function invoiceFields(user: CurrentUser, kind: "invoice" | "quote"): Promise<Field[]> {
  const t = await getTranslations();
  const [clients, matters, currencies] = await Promise.all([clientOptions(), matterOptions(user, {}), enumOptions("Currency")]);
  return [
    { name: "clientId", label: t("f.client"), type: "select", options: clients, required: true },
    { name: "matterId", label: t("f.matter"), type: "select", options: matters, help: t("billing.matterHelp") },
    ...(kind === "invoice"
      ? [
          { name: "issueDate", label: t("f.issueDate"), type: "date" as const, required: true },
          { name: "dueDate", label: t("f.dueDate"), type: "date" as const },
        ]
      : [
          { name: "date", label: t("f.date"), type: "date" as const, required: true },
          { name: "validUntil", label: t("f.validUntil"), type: "date" as const },
        ]),
    { name: "currency", label: t("f.currency"), type: "select", options: currencies, required: true },
    ...(kind === "invoice"
      ? [{ name: "exchangeRate", label: t("f.exchangeRate"), type: "number" as const, help: t("billing.exchangeHelp"), showIf: { field: "currency", values: ["USD", "EUR", "SAR", "GBP"] } }]
      : []),
    { name: "notes", label: t("f.notes"), type: "textarea" },
  ];
}

export async function lineFields(): Promise<Field[]> {
  const t = await getTranslations();
  return [
    { name: "type", label: t("f.lineType"), type: "select", options: await enumOptions("LineType"), required: true },
    { name: "description", label: t("f.description"), required: true, span: 3 },
    { name: "quantity", label: t("f.quantity"), type: "number", required: true },
    { name: "unitPrice", label: t("f.unitPrice"), type: "money", required: true },
    { name: "vatRate", label: t("f.vatRate"), type: "number", required: true },
  ];
}

export async function lineDefaults() {
  const office = await getOffice();
  return { type: "FEE", quantity: 1, vatRate: office.vatRate };
}
