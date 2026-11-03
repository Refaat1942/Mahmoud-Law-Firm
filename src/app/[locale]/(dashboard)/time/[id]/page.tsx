import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Check, Send, Trash2, X } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/session";
import { timeAmount } from "@/lib/time";
import { localized, localizedTitle } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { Badge, STATUS_TONES } from "@/components/ui/badge";
import { ActionButton } from "@/components/action-button";
import { EntityForm } from "@/components/entity-form";
import { DateText, Money } from "@/components/format";
import { DetailList, PageHeader, Section } from "@/components/page";
import { deleteTimeEntry, reviewTime, submitTime, updateTimeEntry } from "@/server/time/actions";
import { EDITABLE, timeScope } from "@/server/time/queries";
import { timeFields } from "../fields";

export default async function TimeEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("time");
  const { id } = await params;
  const t = await getTranslations();
  const locale = await getLocale();
  const e = await prisma.timeEntry.findFirst({
    where: { AND: [timeScope(user), { id }] },
    include: { user: true, approvedBy: true, invoice: true, matter: { include: { client: true } } },
  });
  if (!e) notFound();
  const approver = can(user, "time", "approve");
  const own = e.userId === user.id;
  const editable = e.status !== "BILLED" && (approver || (own && EDITABLE.includes(e.status as never)));

  return (
    <>
      <PageHeader
        title={e.description.length > 80 ? `${e.description.slice(0, 80)}…` : e.description}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONES[e.status]}>{t(`enum.TimeStatus.${e.status}`)}</Badge>
            <DateText value={e.date} /> · {localized(e.user, locale)}
          </span>
        }
        actions={
          <>
            {own && EDITABLE.includes(e.status as never) && (
              <ActionButton action={submitTime} payload={{ ids: [id] }}>
                <Send /> {t("time.submit")}
              </ActionButton>
            )}
            {approver && e.status === "SUBMITTED" && (
              <>
                <ActionButton variant="outline" action={reviewTime} payload={{ ids: [id], decision: "REJECTED" }}>
                  <X /> {t("common.reject")}
                </ActionButton>
                <ActionButton action={reviewTime} payload={{ ids: [id], decision: "APPROVED" }}>
                  <Check /> {t("common.approve")}
                </ActionButton>
              </>
            )}
            {editable && can(user, "time", "delete") && (
              <ActionButton variant="destructive" action={deleteTimeEntry.bind(null, id)} confirm={t("common.confirmDelete")} redirectTo="/time">
                <Trash2 /> {t("common.delete")}
              </ActionButton>
            )}
          </>
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title={t("common.details")}>
          <DetailList
            columns={2}
            items={[
              {
                label: t("f.matter"),
                value: (
                  <Link href={`/cases/${e.matterId}?tab=time`} className="text-primary hover:underline dark:text-accent">
                    {e.matter.fileNo} — {localizedTitle(e.matter, locale)}
                  </Link>
                ),
              },
              { label: t("f.client"), value: localized(e.matter.client, locale) },
              { label: t("f.hours"), value: (e.minutes / 60).toFixed(2) },
              { label: t("f.rate"), value: <Money value={e.rate.toString()} /> },
              { label: t("f.amount"), value: e.billable ? <Money value={timeAmount(e.rate, e.minutes).toString()} /> : t("time.nonBillable") },
              { label: t("time.reviewedBy"), value: localized(e.approvedBy, locale) },
              {
                label: t("f.invoice"),
                value: e.invoice && (
                  <Link href={`/billing/invoices/${e.invoice.id}`} className="text-primary hover:underline dark:text-accent">
                    {e.invoice.number}
                  </Link>
                ),
              },
            ]}
          />
          <p className="mt-4 whitespace-pre-wrap border-t pt-3 text-sm">{e.description}</p>
        </Section>
        {editable && (
          <Section title={t("common.edit")}>
            {e.status === "REJECTED" && <p className="mb-3 text-sm text-destructive">{t("time.rejectedHelp")}</p>}
            <EntityForm
              fields={await timeFields(user)}
              schema="timeEntry"
              action={updateTimeEntry.bind(null, id)}
              defaultValues={{ matterId: e.matterId, date: e.date.toISOString(), hours: (e.minutes / 60).toFixed(2), description: e.description, billable: e.billable }}
            />
          </Section>
        )}
      </div>
    </>
  );
}
