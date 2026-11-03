import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { plain } from "@/lib/plain";
import { can, matterScope, requirePermission } from "@/lib/session";
import { localized, localizedTitle } from "@/lib/utils";
import { getOffice } from "@/lib/settings";
import { Link } from "@/i18n/navigation";
import { Badge, STATUS_TONES } from "@/components/ui/badge";
import { ActionButton } from "@/components/action-button";
import { EntityForm } from "@/components/entity-form";
import { DateText } from "@/components/format";
import { DetailList, PageHeader, Section } from "@/components/page";
import { deleteHearing, recordDecision, updateHearing } from "@/server/hearings/actions";
import { enumOptions } from "@/server/options";
import { hearingFields } from "../fields";

export default async function HearingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("hearings");
  const { id } = await params;
  const t = await getTranslations();
  const locale = await getLocale();
  const office = await getOffice();
  const h = await prisma.hearing.findFirst({
    where: { id, deletedAt: null, matter: matterScope(user) },
    include: { matter: { include: { client: true } }, court: true, lawyer: true, previous: true, next: true },
  });
  if (!h) notFound();
  const canEdit = can(user, "hearings", "update");

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {t("hearings.hearing")} <DateText value={h.date} withTime hijri={office.showHijri} />
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Link href={`/cases/${h.matterId}`} className="text-primary hover:underline dark:text-accent">
              {h.matter.fileNo} — {localizedTitle(h.matter, locale)}
            </Link>
            <Badge tone={STATUS_TONES[h.status]}>{t(`enum.HearingStatus.${h.status}`)}</Badge>
          </span>
        }
        actions={
          can(user, "hearings", "delete") && (
            <ActionButton variant="destructive" action={deleteHearing.bind(null, id)} confirm={t("common.confirmDelete")} redirectTo="/hearings">
              <Trash2 /> {t("common.delete")}
            </ActionButton>
          )
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Section title={t("common.details")}>
            <DetailList
              columns={2}
              items={[
                { label: t("f.client"), value: localized(h.matter.client, locale) },
                { label: t("f.courtCaseNo"), value: <span dir="ltr">{h.matter.courtCaseNo}</span> },
                { label: t("f.court"), value: localized(h.court, locale) },
                { label: t("f.room"), value: h.room },
                { label: t("f.lawyer"), value: localized(h.lawyer, locale) },
                { label: t("f.purpose"), value: h.purpose },
                { label: t("f.decision"), value: h.decision },
                { label: t("f.notes"), value: h.notes },
                {
                  label: t("hearings.previous"),
                  value: h.previous && (
                    <Link href={`/hearings/${h.previous.id}`} className="text-primary hover:underline dark:text-accent">
                      <DateText value={h.previous.date} withTime />
                    </Link>
                  ),
                },
                {
                  label: t("hearings.nextHearing"),
                  value: h.next && (
                    <Link href={`/hearings/${h.next.id}`} className="text-primary hover:underline dark:text-accent">
                      <DateText value={h.next.date} withTime />
                    </Link>
                  ),
                },
              ]}
            />
          </Section>
          {canEdit && (
            <Section title={t("hearings.recordDecision")}>
              <p className="mb-3 text-xs text-muted-foreground">{t("hearings.decisionHelp")}</p>
              <EntityForm
                schema="decision"
                action={recordDecision.bind(null, id)}
                defaultValues={{ status: h.status === "SCHEDULED" ? "POSTPONED" : h.status, decision: h.decision, nextDate: h.next?.date.toISOString().slice(0, 10) }}
                fields={[
                  { name: "status", label: t("f.status"), type: "select", options: await enumOptions("DecisionStatus"), required: true },
                  { name: "nextDate", label: t("hearings.nextDate"), type: "date" },
                  { name: "decision", label: t("f.decision"), type: "textarea" },
                  { name: "nextPurpose", label: t("hearings.nextPurpose"), span: 2 },
                ]}
              />
            </Section>
          )}
        </div>
        {canEdit && (
          <Section title={t("common.edit")}>
            <EntityForm fields={await hearingFields(user)} schema="hearing" action={updateHearing.bind(null, id)} defaultValues={plain(h)} />
          </Section>
        )}
      </div>
    </>
  );
}
