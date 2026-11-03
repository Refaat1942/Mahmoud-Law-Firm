import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { plain } from "@/lib/plain";
import { can, requirePermission } from "@/lib/session";
import { calculateGratuity } from "@/lib/gratuity";
import { allowancesOf, annualLeaveEntitlement } from "@/lib/payroll";
import { daysUntil, isoDate } from "@/lib/deadlines";
import { localized } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { ActionButton } from "@/components/action-button";
import { DataTable } from "@/components/data-table";
import { EntityForm } from "@/components/entity-form";
import { DateText, Money } from "@/components/format";
import { DetailList, PageHeader, Section, StatCard, Tabs } from "@/components/page";
import { enumOptions } from "@/server/options";
import { addEmployeeDoc, deleteEmployee, deleteEmployeeDoc, updateEmployee } from "@/server/hr/actions";
import { employeeFields } from "../fields";

export default async function EmployeePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; endDate?: string; unpaid?: string }> }) {
  const user = await requirePermission("hr");
  const { id } = await params;
  const sp = await searchParams;
  const tab = sp.tab ?? "overview";
  const t = await getTranslations();
  const locale = await getLocale();
  const e = await prisma.employee.findFirst({
    where: { id, deletedAt: null },
    include: {
      user: true,
      documents: { orderBy: { expiryDate: "asc" } },
      leaves: { orderBy: { fromDate: "desc" } },
      payrollLines: { include: { payroll: true }, orderBy: { payroll: { period: "desc" } } },
    },
  });
  if (!e) notFound();
  const canEdit = can(user, "hr", "update");
  const year = new Date().getFullYear();
  const entitlement = annualLeaveEntitlement({ joinDate: e.joinDate, annualDays: e.annualLeaveDays, year, asOf: new Date() });
  const taken = e.leaves.filter((l) => l.type === "ANNUAL" && l.status === "APPROVED" && l.fromDate.getFullYear() === year).reduce((a, l) => a + l.days, 0);
  const tabs = ["overview", "documents", "leave", "payroll", "gratuity"].map((key) => ({ key, label: t(`hr.tabs.${key}`) }));

  let content: React.ReactNode;
  if (tab === "documents") {
    content = (
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title={t("hr.tabs.documents")}>
          {e.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>{t("f.type")}</Th>
                  <Th>{t("f.number")}</Th>
                  <Th>{t("f.issueDate")}</Th>
                  <Th>{t("f.expiresAt")}</Th>
                  {canEdit && <Th />}
                </tr>
              </thead>
              <tbody>
                {e.documents.map((d) => {
                  const left = d.expiryDate ? daysUntil(d.expiryDate) : null;
                  return (
                    <tr key={d.id}>
                      <Td>{t(`enum.EmployeeDocType.${d.type}`)}</Td>
                      <Td dir="ltr">{d.number}</Td>
                      <Td>
                        <DateText value={d.issueDate} />
                      </Td>
                      <Td>
                        <DateText value={d.expiryDate} />{" "}
                        {left !== null && left < 0 && <Badge tone="danger">{t("enum.ExpiryState.EXPIRED")}</Badge>}
                        {left !== null && left >= 0 && left <= 30 && <Badge tone="warning">{t("clients.daysLeft", { days: left })}</Badge>}
                      </Td>
                      {canEdit && (
                        <Td>
                          <ActionButton variant="ghost" size="icon" action={deleteEmployeeDoc.bind(null, d.id)} confirm={t("common.confirmDelete")} aria-label={t("common.delete")}>
                            <Trash2 />
                          </ActionButton>
                        </Td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Section>
        {canEdit && (
          <Section title={t("hr.addDocument")}>
            <EntityForm
              schema="employeeDoc"
              action={addEmployeeDoc.bind(null, id)}
              defaultValues={{ type: "EMIRATES_ID" }}
              resetOnSuccess
              submitLabel={t("common.add")}
              fields={[
                { name: "type", label: t("f.type"), type: "select", options: await enumOptions("EmployeeDocType"), required: true },
                { name: "number", label: t("f.number"), required: true, dir: "ltr" },
                { name: "issueDate", label: t("f.issueDate"), type: "date" },
                { name: "expiryDate", label: t("f.expiresAt"), type: "date", help: t("hr.expiryHelp") },
              ]}
            />
          </Section>
        )}
      </div>
    );
  } else if (tab === "leave") {
    content = (
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-3 md:max-w-2xl">
          <StatCard label={t("hr.entitlement", { year })} value={entitlement} />
          <StatCard label={t("hr.taken")} value={taken} />
          <StatCard label={t("hr.leaveBalance")} value={Math.max(0, entitlement - taken)} />
        </div>
        <DataTable
          columns={[
            { key: "type", label: t("f.leaveType"), type: "badge", enumKey: "LeaveType" },
            { key: "fromDate", label: t("common.from"), type: "date" },
            { key: "toDate", label: t("common.to"), type: "date" },
            { key: "days", label: t("f.days"), type: "number" },
            { key: "status", label: t("f.status"), type: "badge", enumKey: "ApprovalStatus" },
          ]}
          rows={e.leaves.map((l) => ({ id: l.id, type: l.type, fromDate: l.fromDate.toISOString(), toDate: l.toDate.toISOString(), days: l.days, status: l.status }))}
        />
      </div>
    );
  } else if (tab === "payroll") {
    content = (
      <DataTable
        columns={[
          { key: "period", label: t("f.period"), href: "/hr/payroll/:payrollId" },
          { key: "basic", label: t("f.basicSalary"), type: "money" },
          { key: "allowances", label: t("hr.allowances"), type: "money" },
          { key: "additions", label: t("f.additions"), type: "money" },
          { key: "deductions", label: t("f.deductions"), type: "money" },
          { key: "net", label: t("f.netSalary"), type: "money" },
          { key: "status", label: t("f.status"), type: "badge", enumKey: "PayrollStatus" },
        ]}
        rows={e.payrollLines.map((l) => ({
          id: l.id,
          payrollId: l.payrollId,
          period: l.payroll.period,
          basic: l.basic.toString(),
          allowances: l.allowances.toString(),
          additions: l.additions.toString(),
          deductions: l.deductions.toString(),
          net: l.net.toString(),
          status: l.payroll.status,
        }))}
      />
    );
  } else if (tab === "gratuity") {
    const endDate = sp.endDate ? new Date(`${sp.endDate}T00:00:00`) : (e.endDate ?? new Date());
    const unpaid = Math.max(0, Number(sp.unpaid) || 0);
    const g = calculateGratuity({ basicSalary: e.basicSalary, joinDate: e.joinDate, endDate, unpaidLeaveDays: unpaid });
    content = (
      <Section title={t("hr.gratuity")}>
        <form className="no-print mb-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="tab" value="gratuity" />
          <label className="space-y-1 text-sm">
            <span>{t("f.endDate")}</span>
            <Input type="date" name="endDate" defaultValue={isoDate(endDate)} className="w-44" />
          </label>
          <label className="space-y-1 text-sm">
            <span>{t("f.unpaidLeaveDays")}</span>
            <Input type="number" min={0} name="unpaid" defaultValue={unpaid} className="w-32" />
          </label>
          <button className={buttonVariants({ variant: "outline" })}>{t("hr.calculate")}</button>
        </form>
        <DetailList
          columns={3}
          items={[
            { label: t("f.joinDate"), value: <DateText value={e.joinDate} /> },
            { label: t("hr.serviceDays"), value: g.serviceDays },
            { label: t("hr.serviceYears"), value: g.years.toFixed(2) },
            { label: t("f.basicSalary"), value: <Money value={e.basicSalary.toString()} /> },
            { label: t("hr.dailyWage"), value: <Money value={g.dailyWage.toString()} /> },
            { label: t("hr.gratuityAmount"), value: <span className="text-lg font-bold"><Money value={g.amount.toString()} /></span> },
          ]}
        />
        {g.capped && <p className="mt-3 text-sm text-warning">{t("hr.gratuityCapped")}</p>}
        <p className="mt-3 text-xs text-muted-foreground">{t("hr.gratuityHelp")}</p>
      </Section>
    );
  } else {
    content = (
      <div className="grid gap-5 lg:grid-cols-3">
        <Section title={t("common.details")}>
          <DetailList
            columns={2}
            items={[
              { label: t("f.code"), value: e.code },
              { label: t("f.position"), value: e.position },
              { label: t("f.department"), value: e.department },
              { label: t("f.nationality"), value: e.nationality },
              { label: t("f.joinDate"), value: <DateText value={e.joinDate} /> },
              { label: t("f.contractType"), value: t(`enum.ContractType.${e.contractType}`) },
              { label: t("f.basicSalary"), value: <Money value={e.basicSalary.toString()} /> },
              { label: t("hr.allowances"), value: <Money value={allowancesOf(e).toString()} /> },
              { label: t("hr.systemUser"), value: e.user && localized(e.user, locale) },
              { label: t("hr.leaveBalance"), value: Math.max(0, entitlement - taken) },
            ]}
          />
        </Section>
        {canEdit && (
          <Section title={t("common.edit")} className="lg:col-span-2">
            <EntityForm fields={await employeeFields()} schema="employee" action={updateEmployee.bind(null, id)} defaultValues={plain(e)} columns={3} />
          </Section>
        )}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={localized(e, locale)}
        subtitle={
          <span className="flex items-center gap-2">
            {e.code} · {e.position}
            <Badge tone={e.status === "ACTIVE" ? "success" : e.status === "ON_LEAVE" ? "warning" : "neutral"}>{t(`enum.EmployeeStatus.${e.status}`)}</Badge>
          </span>
        }
        actions={
          can(user, "hr", "delete") && (
            <ActionButton variant="destructive" action={deleteEmployee.bind(null, id)} confirm={t("common.confirmDelete")} redirectTo="/hr">
              <Trash2 /> {t("common.delete")}
            </ActionButton>
          )
        }
      />
      <Tabs tabs={tabs} active={tab} base={`/hr/employees/${id}`} />
      {content}
    </>
  );
}
