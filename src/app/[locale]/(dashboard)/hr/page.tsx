import { getLocale, getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/session";
import { allowancesOf } from "@/lib/payroll";
import { sum } from "@/lib/money";
import { addDays, localized, startOfDay } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { Money } from "@/components/format";
import { PageHeader, StatCard } from "@/components/page";
import { enumOptions } from "@/server/options";
import { HrNav } from "./nav";

export default async function HrPage() {
  const user = await requirePermission("hr");
  const t = await getTranslations();
  const locale = await getLocale();
  const employees = await prisma.employee.findMany({ where: { deletedAt: null }, include: { documents: true }, orderBy: { code: "asc" } });
  const active = employees.filter((e) => e.status !== "TERMINATED");
  const horizon = addDays(startOfDay(), 30);
  const expiring = employees.flatMap((e) => e.documents.filter((d) => d.expiryDate && d.expiryDate < horizon));
  const pendingLeave = await prisma.leaveRequest.count({ where: { status: "PENDING", employee: { deletedAt: null } } });
  const monthly = sum(active.map((e) => e.basicSalary.plus(allowancesOf(e))));

  return (
    <>
      <PageHeader
        title={t("nav.hr")}
        actions={
          can(user, "hr", "create") && (
            <Link href="/hr/employees/new" className={buttonVariants()}>
              <Plus /> {t("hr.newEmployee")}
            </Link>
          )
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("hr.headcount")} value={active.length} />
        <StatCard label={t("hr.monthlyCost")} value={<Money value={monthly.toString()} />} />
        <StatCard label={t("hr.expiringDocs")} value={expiring.length} />
        <StatCard label={t("hr.pendingLeave")} value={pendingLeave} href="/hr/leave" />
      </div>
      <HrNav active="employees" />
      <DataTable
        exportName="employees"
        emptyText={t("hr.noEmployees")}
        filters={[
          { key: "status", label: t("f.status"), options: await enumOptions("EmployeeStatus") },
          { key: "department", label: t("f.department"), options: [...new Set(employees.map((e) => e.department).filter(Boolean) as string[])].map((v) => ({ value: v, label: v })) },
        ]}
        columns={[
          { key: "code", label: t("f.code"), href: "/hr/employees/:id" },
          { key: "name", label: t("f.name"), href: "/hr/employees/:id" },
          { key: "position", label: t("f.position") },
          { key: "department", label: t("f.department") },
          { key: "joinDate", label: t("f.joinDate"), type: "date" },
          { key: "salary", label: t("hr.totalSalary"), type: "money" },
          { key: "nextExpiry", label: t("hr.nextExpiry"), type: "date" },
          { key: "status", label: t("f.status"), type: "badge", enumKey: "EmployeeStatus" },
        ]}
        rows={employees.map((e) => {
          const next = e.documents.map((d) => d.expiryDate).filter(Boolean).sort((a, b) => +a! - +b!)[0];
          return {
            id: e.id,
            code: e.code,
            name: localized(e, locale),
            position: e.position ?? "",
            department: e.department ?? "",
            joinDate: e.joinDate.toISOString(),
            salary: e.basicSalary.plus(allowancesOf(e)).toString(),
            nextExpiry: next?.toISOString() ?? "",
            status: e.status,
          };
        })}
      />
    </>
  );
}
