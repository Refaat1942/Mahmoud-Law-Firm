import { getLocale, getTranslations } from "next-intl/server";
import { Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/session";
import { isoDate } from "@/lib/deadlines";
import { localized } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { ActionButton } from "@/components/action-button";
import { EntityForm } from "@/components/entity-form";
import { PageHeader, Section } from "@/components/page";
import { employeeOptions, enumOptions } from "@/server/options";
import { deleteAttendance, saveAttendance } from "@/server/hr/actions";
import { HrNav } from "../nav";

const TONES = { PRESENT: "success", REMOTE: "info", LATE: "warning", ABSENT: "danger", LEAVE: "neutral" } as const;
const hhmm = (d: Date | null) => (d ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", hour: "2-digit", minute: "2-digit", hour12: false }).format(d) : "");

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await requirePermission("hr");
  const t = await getTranslations();
  const locale = await getLocale();
  const date = (await searchParams).date || isoDate(new Date());
  const day = new Date(`${date}T00:00:00Z`);
  const [employees, records] = await Promise.all([
    prisma.employee.findMany({ where: { deletedAt: null, status: { not: "TERMINATED" } }, orderBy: { code: "asc" } }),
    prisma.attendance.findMany({ where: { date: day } }),
  ]);
  const byEmployee = new Map(records.map((r) => [r.employeeId, r]));
  return (
    <>
      <PageHeader title={t("nav.hr")} />
      <HrNav active="attendance" />
      <div className="grid gap-5 xl:grid-cols-3">
        <Section className="xl:col-span-2">
          <form className="no-print mb-4 flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-sm">
              <span>{t("f.date")}</span>
              <Input type="date" name="date" defaultValue={date} className="w-44" />
            </label>
            <button className={buttonVariants({ variant: "outline" })}>{t("common.apply")}</button>
          </form>
          <Table>
            <thead>
              <tr>
                <Th>{t("f.employee")}</Th>
                <Th>{t("f.status")}</Th>
                <Th>{t("f.checkIn")}</Th>
                <Th>{t("f.checkOut")}</Th>
                <Th>{t("f.notes")}</Th>
                {can(user, "hr", "delete") && <Th />}
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => {
                const r = byEmployee.get(e.id);
                return (
                  <tr key={e.id}>
                    <Td>
                      {localized(e, locale)} <span className="text-xs text-muted-foreground">({e.code})</span>
                    </Td>
                    <Td>{r ? <Badge tone={TONES[r.status]}>{t(`enum.AttendanceStatus.${r.status}`)}</Badge> : <span className="text-xs text-muted-foreground">{t("hr.notRecorded")}</span>}</Td>
                    <Td dir="ltr">{hhmm(r?.checkIn ?? null)}</Td>
                    <Td dir="ltr">{hhmm(r?.checkOut ?? null)}</Td>
                    <Td>{r?.notes}</Td>
                    {can(user, "hr", "delete") && (
                      <Td>
                        {r && (
                          <ActionButton variant="ghost" size="icon" action={deleteAttendance.bind(null, r.id)} aria-label={t("common.delete")}>
                            <Trash2 />
                          </ActionButton>
                        )}
                      </Td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Section>
        {can(user, "hr", "create") && (
          <Section title={t("hr.recordAttendance")}>
            <EntityForm
              schema="attendance"
              action={saveAttendance}
              columns={2}
              defaultValues={{ date, status: "PRESENT" }}
              fields={[
                { name: "employeeId", label: t("f.employee"), type: "select", options: await employeeOptions(), required: true, span: 2 },
                { name: "date", label: t("f.date"), type: "date", required: true },
                { name: "status", label: t("f.status"), type: "select", options: await enumOptions("AttendanceStatus"), required: true },
                { name: "checkIn", label: t("f.checkIn"), type: "time" },
                { name: "checkOut", label: t("f.checkOut"), type: "time" },
                { name: "notes", label: t("f.notes"), span: 2 },
              ]}
            />
            <p className="mt-3 text-xs text-muted-foreground">{t("hr.attendanceHelp")}</p>
          </Section>
        )}
      </div>
    </>
  );
}
