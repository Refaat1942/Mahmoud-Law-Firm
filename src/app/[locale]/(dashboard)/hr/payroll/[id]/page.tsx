import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { CheckCircle2, FileDown, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/session";
import { getOffice } from "@/lib/settings";
import { sum } from "@/lib/money";
import { isoDate } from "@/lib/deadlines";
import { localized } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { Badge, STATUS_TONES } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { ActionButton } from "@/components/action-button";
import { EntityForm } from "@/components/entity-form";
import { DateText, Money } from "@/components/format";
import { PageHeader, Section } from "@/components/page";
import { bankOptions } from "@/server/options";
import { approvePayroll, deletePayroll, payPayroll, reopenPayroll, updatePayrollLine } from "@/server/hr/actions";

export default async function PayrollDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ line?: string }> }) {
  const user = await requirePermission("hr");
  const { id } = await params;
  const sp = await searchParams;
  const t = await getTranslations();
  const locale = await getLocale();
  const pr = await prisma.payroll.findUnique({ where: { id }, include: { lines: { include: { employee: true }, orderBy: { employee: { code: "asc" } } } } });
  if (!pr) notFound();
  const office = await getOffice();
  const draft = pr.status === "DRAFT";
  const approver = can(user, "hr", "approve");
  const editing = draft && can(user, "hr", "update") ? pr.lines.find((l) => l.id === sp.line) : undefined;
  const wpsReady = !!office.wpsEmployerId && !!office.wpsBankCode && pr.lines.every((l) => l.employee.molPersonId && l.employee.bankRoutingCode && l.employee.iban);
  const totals = { basic: sum(pr.lines.map((l) => l.basic)), allowances: sum(pr.lines.map((l) => l.allowances)), additions: sum(pr.lines.map((l) => l.additions)), deductions: sum(pr.lines.map((l) => l.deductions)) };

  return (
    <>
      <PageHeader
        title={t("hr.payrollFor", { period: pr.period })}
        subtitle={
          <span className="flex items-center gap-2">
            <Badge tone={STATUS_TONES[pr.status]}>{t(`enum.PayrollStatus.${pr.status}`)}</Badge>
            {pr.paidAt && (
              <>
                {t("hr.paidAt")} <DateText value={pr.paidAt} />
              </>
            )}
          </span>
        }
        actions={
          <>
            {!draft && approver && (
              <a href={`/api/hr/payroll/${id}/sif?locale=${locale}`} className={buttonVariants({ variant: "outline" })} title={wpsReady ? undefined : t("hr.sifNotReady")}>
                <FileDown /> {t("hr.downloadSif")}
              </a>
            )}
            {draft && can(user, "hr", "delete") && (
              <ActionButton variant="destructive" action={deletePayroll.bind(null, id)} confirm={t("common.confirmDelete")} redirectTo="/hr/payroll">
                <Trash2 /> {t("common.delete")}
              </ActionButton>
            )}
            {pr.status === "APPROVED" && approver && (
              <ActionButton variant="outline" action={reopenPayroll.bind(null, id)}>
                <RotateCcw /> {t("hr.reopen")}
              </ActionButton>
            )}
            {draft && approver && (
              <ActionButton action={approvePayroll.bind(null, id)} confirm={t("hr.confirmApprove")}>
                <CheckCircle2 /> {t("common.approve")}
              </ActionButton>
            )}
          </>
        }
      />
      {!draft && !wpsReady && <p className="mb-4 rounded-lg bg-warning/10 p-3 text-sm">{t("hr.sifNotReady")}</p>}
      <div className="grid gap-5 xl:grid-cols-3">
        <Section className="xl:col-span-2">
          <Table>
            <thead>
              <tr>
                <Th>{t("f.employee")}</Th>
                <Th>{t("f.basicSalary")}</Th>
                <Th>{t("hr.allowances")}</Th>
                <Th>{t("f.additions")}</Th>
                <Th>{t("f.deductions")}</Th>
                <Th>{t("hr.leaveDaysShort")}</Th>
                <Th>{t("f.netSalary")}</Th>
                {draft && can(user, "hr", "update") && <Th />}
              </tr>
            </thead>
            <tbody>
              {pr.lines.map((l) => (
                <tr key={l.id} className={l.id === editing?.id ? "bg-accent/10" : ""}>
                  <Td>
                    <Link href={`/hr/employees/${l.employeeId}`} className="text-primary hover:underline dark:text-accent">
                      {localized(l.employee, locale)}
                    </Link>
                    {l.notes && <p className="text-xs text-muted-foreground">{l.notes}</p>}
                  </Td>
                  <Td>
                    <Money value={l.basic.toString()} />
                  </Td>
                  <Td>
                    <Money value={l.allowances.toString()} />
                  </Td>
                  <Td>
                    <Money value={l.additions.toString()} />
                  </Td>
                  <Td>
                    <Money value={l.deductions.toString()} />
                  </Td>
                  <Td className="tabular-nums">{l.leaveDays}</Td>
                  <Td className="font-semibold">
                    <Money value={l.net.toString()} />
                  </Td>
                  {draft && can(user, "hr", "update") && (
                    <Td>
                      <Link href={`/hr/payroll/${id}?line=${l.id}`} scroll={false} className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label={t("common.edit")}>
                        <Pencil />
                      </Link>
                    </Td>
                  )}
                </tr>
              ))}
              <tr className="font-bold">
                <Td>{t("common.total")}</Td>
                <Td>
                  <Money value={totals.basic.toString()} />
                </Td>
                <Td>
                  <Money value={totals.allowances.toString()} />
                </Td>
                <Td>
                  <Money value={totals.additions.toString()} />
                </Td>
                <Td>
                  <Money value={totals.deductions.toString()} />
                </Td>
                <Td />
                <Td>
                  <Money value={pr.total.toString()} />
                </Td>
                {draft && can(user, "hr", "update") && <Td />}
              </tr>
            </tbody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">{t("hr.payrollLinesHelp")}</p>
        </Section>
        <div className="space-y-5">
          {editing && (
            <Section title={localized(editing.employee, locale)}>
              <EntityForm
                key={editing.id}
                schema="payrollLine"
                action={updatePayrollLine.bind(null, editing.id)}
                defaultValues={{ additions: editing.additions.toString(), deductions: editing.deductions.toString(), leaveDays: editing.leaveDays, notes: editing.notes }}
                fields={[
                  { name: "additions", label: t("f.additions"), type: "money", help: t("hr.additionsHelp") },
                  { name: "deductions", label: t("f.deductions"), type: "money", help: t("hr.deductionsHelp") },
                  { name: "leaveDays", label: t("hr.leaveDaysShort"), type: "number", help: t("hr.leaveDaysHelp") },
                  { name: "notes", label: t("f.notes"), type: "textarea" },
                ]}
              />
            </Section>
          )}
          {pr.status === "APPROVED" && approver && (
            <Section title={t("hr.pay")}>
              <EntityForm
                schema="payPayroll"
                action={payPayroll.bind(null, id)}
                columns={1}
                defaultValues={{ date: isoDate(new Date()), bankAccountId: (await bankOptions())[1]?.value }}
                fields={[
                  { name: "bankAccountId", label: t("accounting.paidFrom"), type: "select", options: await bankOptions(), required: true },
                  { name: "date", label: t("f.date"), type: "date", required: true },
                ]}
                submitLabel={t("hr.markPaid")}
              />
            </Section>
          )}
        </div>
      </div>
    </>
  );
}
