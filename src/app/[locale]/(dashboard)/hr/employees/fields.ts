import { getTranslations } from "next-intl/server";
import type { Field } from "@/components/entity-form";
import { enumOptions, userOptions } from "@/server/options";

export async function employeeFields(): Promise<Field[]> {
  const t = await getTranslations();
  const [users, contracts, statuses] = await Promise.all([userOptions(), enumOptions("ContractType"), enumOptions("EmployeeStatus")]);
  return [
    { name: "nameAr", label: t("f.nameAr"), required: true },
    { name: "nameEn", label: t("f.nameEn"), required: true, dir: "ltr", help: t("hr.nameEnHelp") },
    { name: "position", label: t("f.position") },
    { name: "department", label: t("f.department") },
    { name: "nationality", label: t("f.nationality") },
    { name: "userId", label: t("hr.systemUser"), type: "select", options: users },
    { name: "joinDate", label: t("f.joinDate"), type: "date", required: true },
    { name: "endDate", label: t("f.endDate"), type: "date" },
    { name: "contractType", label: t("f.contractType"), type: "select", options: contracts, required: true },
    { name: "status", label: t("f.status"), type: "select", options: statuses, required: true },
    { name: "emiratesId", label: t("f.emiratesId"), dir: "ltr", placeholder: "784-XXXX-XXXXXXX-X" },
    { name: "passportNo", label: t("f.passportNo"), dir: "ltr" },
    { name: "laborCardNo", label: t("f.laborCardNo"), dir: "ltr" },
    { name: "molPersonId", label: t("f.molPersonId"), dir: "ltr", help: t("hr.wpsHelp") },
    { name: "bankRoutingCode", label: t("f.bankRoutingCode"), dir: "ltr", help: t("hr.wpsHelp") },
    { name: "iban", label: t("f.iban"), dir: "ltr", help: t("hr.wpsHelp") },
    { name: "basicSalary", label: t("f.basicSalary"), type: "money", required: true, help: t("hr.basicHelp") },
    { name: "housingAllowance", label: t("f.housingAllowance"), type: "money" },
    { name: "transportAllowance", label: t("f.transportAllowance"), type: "money" },
    { name: "otherAllowance", label: t("f.otherAllowance"), type: "money" },
    { name: "annualLeaveDays", label: t("f.annualLeaveDays"), type: "number", required: true },
  ];
}
