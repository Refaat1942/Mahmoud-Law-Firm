import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { X } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/session";
import { addDays, localizedTitle } from "@/lib/utils";
import { isoDate } from "@/lib/deadlines";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/action-button";
import { EntityForm } from "@/components/entity-form";
import { DateText, Money } from "@/components/format";
import { DetailList, PageHeader, Section } from "@/components/page";
import { matterOptions } from "@/server/options";
import { applyCourtUpdate, dismissCourtUpdate } from "@/server/courts/actions";
import { courtUpdateScope } from "@/server/courts/queries";

export default async function CourtUpdatePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("matters");
  const { id } = await params;
  const t = await getTranslations();
  const locale = await getLocale();
  const u = await prisma.courtUpdate.findFirst({ where: { AND: [courtUpdateScope(user), { id }] }, include: { matter: true } });
  if (!u) notFound();
  const pending = u.status === "PENDING" && can(user, "matters", "update");
  return (
    <>
      <PageHeader
        title={u.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{t(`enum.CourtUpdateKind.${u.kind}`)}</Badge>
            <Badge tone={u.status === "APPLIED" ? "success" : u.status === "DISMISSED" ? "neutral" : "warning"}>{t(`enum.CourtUpdateStatus.${u.status}`)}</Badge>
            <DateText value={u.occurredAt} />
          </span>
        }
        actions={
          pending && (
            <ActionButton variant="outline" action={dismissCourtUpdate.bind(null, id)} confirm={t("courts.confirmDismiss")} redirectTo="/court-updates">
              <X /> {t("courts.dismiss")}
            </ActionButton>
          )
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title={t("common.details")}>
          <DetailList
            columns={2}
            items={[
              { label: t("f.courtCaseNo"), value: <span dir="ltr">{u.courtCaseNo}</span> },
              { label: t("courts.courtSystem"), value: u.courtSystem && t(`enum.CourtSystem.${u.courtSystem}`) },
              { label: t("f.matter"), value: u.matter ? <Link href={`/cases/${u.matter.id}`} className="text-primary hover:underline dark:text-accent">{u.matter.fileNo} — {localizedTitle(u.matter, locale)}</Link> : t("courts.unmatched") },
              { label: t("courts.executionType"), value: u.executionType && t(`enum.ExecutionActionType.${u.executionType}`) },
              { label: t("f.amount"), value: u.amount && <Money value={u.amount.toString()} /> },
              { label: t("courts.nextHearing"), value: u.nextHearingAt && <DateText value={u.nextHearingAt} withTime /> },
              { label: t("courts.source"), value: t(`courts.sourceKinds.${u.source === "csv" ? "csv" : u.source === "manual" ? "manual" : "adapter"}`) },
              { label: t("f.details"), value: u.details },
            ]}
          />
        </Section>
        {pending && (
          <Section title={t("courts.apply")}>
            <p className="mb-3 text-sm text-muted-foreground">{t(`courts.applyEffect.${u.kind}`)}</p>
            <EntityForm
              schema="applyUpdate"
              action={applyCourtUpdate.bind(null, id)}
              redirectTo="/court-updates"
              submitLabel={t("courts.apply")}
              defaultValues={{ matterId: u.matterId ?? undefined, createTask: false, taskTitle: t("courts.followUpTask", { title: u.title }), taskDueDate: isoDate(addDays(new Date(), 2)) }}
              fields={[
                { name: "matterId", label: t("f.matter"), type: "select", options: await matterOptions(user, {}), required: true, span: 2 },
                { name: "createTask", label: t("courts.createTask"), type: "checkbox", span: 2 },
                { name: "taskTitle", label: t("f.title"), showIf: { field: "createTask", values: ["true"] } },
                { name: "taskDueDate", label: t("f.dueDate"), type: "date", showIf: { field: "createTask", values: ["true"] } },
              ]}
            />
          </Section>
        )}
      </div>
    </>
  );
}
