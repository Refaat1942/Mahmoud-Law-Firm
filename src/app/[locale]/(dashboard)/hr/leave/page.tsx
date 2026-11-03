import { getLocale, getTranslations } from "next-intl/server";
import { Check, Trash2, X } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/session";
import { localized } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { Badge, STATUS_TONES } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { ActionButton } from "@/components/action-button";
import { EntityForm } from "@/components/entity-form";
import { DateText } from "@/components/format";
import { PageHeader, Section } from "@/components/page";
import { employeeOptions, enumOptions } from "@/server/options";
import { deleteLeave, requestLeave, reviewLeave } from "@/server/hr/actions";
import { HrNav } from "../nav";

export default async function LeavePage() {
  const user = await requirePermission("hr");
  const t = await getTranslations();
  const locale = await getLocale();
  const leaves = await prisma.leaveRequest.findMany({ where: { employee: { deletedAt: null } }, include: { employee: true, approvedBy: true }, orderBy: [{ status: "asc" }, { fromDate: "desc" }], take: 1000 });
  const approver = can(user, "hr", "approve");
  return (
    <>
      <PageHeader title={t("nav.hr")} />
      <HrNav active="leave" />
      <div className="grid gap-5 xl:grid-cols-3">
        <Section title={t("hr.leaveRequests")} className="xl:col-span-2">
          {leaves.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>{t("f.employee")}</Th>
                  <Th>{t("f.leaveType")}</Th>
                  <Th>{t("common.from")}</Th>
                  <Th>{t("common.to")}</Th>
                  <Th>{t("f.days")}</Th>
                  <Th>{t("f.status")}</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {leaves.map((l) => (
                  <tr key={l.id}>
                    <Td>
                      <Link href={`/hr/employees/${l.employeeId}?tab=leave`} className="text-primary hover:underline dark:text-accent">
                        {localized(l.employee, locale)}
                      </Link>
                      {l.reason && <p className="text-xs text-muted-foreground">{l.reason}</p>}
                    </Td>
                    <Td>{t(`enum.LeaveType.${l.type}`)}</Td>
                    <Td>
                      <DateText value={l.fromDate} />
                    </Td>
                    <Td>
                      <DateText value={l.toDate} />
                    </Td>
                    <Td className="tabular-nums">{l.days}</Td>
                    <Td>
                      <Badge tone={STATUS_TONES[l.status]}>{t(`enum.ApprovalStatus.${l.status}`)}</Badge>
                      {l.approvedBy && <p className="text-xs text-muted-foreground">{localized(l.approvedBy, locale)}</p>}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {approver && l.status === "PENDING" && (
                        <>
                          <ActionButton variant="ghost" size="icon" action={reviewLeave.bind(null, l.id)} payload={{ status: "APPROVED" }} aria-label={t("common.approve")}>
                            <Check />
                          </ActionButton>
                          <ActionButton variant="ghost" size="icon" action={reviewLeave.bind(null, l.id)} payload={{ status: "REJECTED" }} aria-label={t("common.reject")}>
                            <X />
                          </ActionButton>
                        </>
                      )}
                      {can(user, "hr", "delete") && l.status !== "APPROVED" && (
                        <ActionButton variant="ghost" size="icon" action={deleteLeave.bind(null, l.id)} confirm={t("common.confirmDelete")} aria-label={t("common.delete")}>
                          <Trash2 />
                        </ActionButton>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Section>
        {can(user, "hr", "create") && (
          <Section title={t("hr.newLeave")}>
            <EntityForm
              schema="leave"
              action={requestLeave}
              resetOnSuccess
              defaultValues={{ type: "ANNUAL" }}
              fields={[
                { name: "employeeId", label: t("f.employee"), type: "select", options: await employeeOptions(), required: true, span: 2 },
                { name: "type", label: t("f.leaveType"), type: "select", options: await enumOptions("LeaveType"), required: true, span: 2 },
                { name: "fromDate", label: t("common.from"), type: "date", required: true },
                { name: "toDate", label: t("common.to"), type: "date", required: true },
                { name: "reason", label: t("f.reason"), type: "textarea" },
              ]}
            />
            <p className="mt-3 text-xs text-muted-foreground">{t("hr.leaveHelp")}</p>
          </Section>
        )}
      </div>
    </>
  );
}
