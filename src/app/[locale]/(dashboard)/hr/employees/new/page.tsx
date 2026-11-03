import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/session";
import { isoDate } from "@/lib/deadlines";
import { EntityForm } from "@/components/entity-form";
import { PageHeader, Section } from "@/components/page";
import { createEmployee } from "@/server/hr/actions";
import { employeeFields } from "../fields";

export default async function NewEmployeePage() {
  await requirePermission("hr", "create");
  const t = await getTranslations();
  return (
    <>
      <PageHeader title={t("hr.newEmployee")} />
      <Section>
        <EntityForm
          fields={await employeeFields()}
          schema="employee"
          action={createEmployee}
          columns={3}
          defaultValues={{ joinDate: isoDate(new Date()), contractType: "UNLIMITED", status: "ACTIVE", annualLeaveDays: 30 }}
          redirectTo="/hr/employees/:id"
        />
      </Section>
    </>
  );
}
