import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/session";
import { DataTable } from "@/components/data-table";
import { EntityForm } from "@/components/entity-form";
import { PageHeader, Section } from "@/components/page";
import { createPayroll } from "@/server/hr/actions";
import { HrNav } from "../nav";

export default async function PayrollPage() {
  const user = await requirePermission("hr");
  const t = await getTranslations();
  const payrolls = await prisma.payroll.findMany({ include: { _count: { select: { lines: true } } }, orderBy: { period: "desc" } });
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return (
    <>
      <PageHeader title={t("nav.hr")} />
      <HrNav active="payroll" />
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <DataTable
            exportName="payrolls"
            emptyText={t("hr.noPayrolls")}
            columns={[
              { key: "period", label: t("f.period"), href: "/hr/payroll/:id" },
              { key: "employees", label: t("hr.employeesCount"), type: "number" },
              { key: "total", label: t("f.total"), type: "money" },
              { key: "paidAt", label: t("hr.paidAt"), type: "date" },
              { key: "status", label: t("f.status"), type: "badge", enumKey: "PayrollStatus" },
            ]}
            rows={payrolls.map((p) => ({ id: p.id, period: p.period, employees: p._count.lines, total: p.total.toString(), paidAt: p.paidAt?.toISOString() ?? "", status: p.status }))}
          />
        </div>
        {can(user, "hr", "create") && (
          <Section title={t("hr.newPayroll")}>
            <EntityForm
              schema="payroll"
              action={createPayroll}
              columns={1}
              defaultValues={{ period }}
              redirectTo="/hr/payroll/:id"
              fields={[{ name: "period", label: t("f.period"), placeholder: "YYYY-MM", dir: "ltr", required: true, help: t("hr.payrollHelp") }]}
            />
          </Section>
        )}
      </div>
    </>
  );
}
