import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { plain } from "@/lib/plain";
import { can, requirePermission } from "@/lib/session";
import { localized, localizedTitle } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/action-button";
import { EntityForm } from "@/components/entity-form";
import { DateText } from "@/components/format";
import { DetailList, PageHeader, Section } from "@/components/page";
import { deleteFiling, updateFiling } from "@/server/courts/actions";
import { filingScope } from "@/server/courts/queries";
import { filingFields } from "../fields";

export default async function FilingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("matters");
  const { id } = await params;
  const t = await getTranslations();
  const locale = await getLocale();
  const f = await prisma.courtFiling.findFirst({ where: { AND: [filingScope(user), { id }] }, include: { matter: true, assignee: true } });
  if (!f) notFound();
  return (
    <>
      <PageHeader
        title={f.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{t(`enum.FilingKind.${f.kind}`)}</Badge>
            <Badge tone="neutral">{t(`enum.FilingDirection.${f.direction}`)}</Badge>
            <Badge tone="info">{t(`enum.FilingStatus.${f.status}`)}</Badge>
          </span>
        }
        actions={
          can(user, "matters", "delete") && (
            <ActionButton variant="destructive" action={deleteFiling.bind(null, id)} confirm={t("common.confirmDelete")} redirectTo="/court-filings">
              <Trash2 /> {t("common.delete")}
            </ActionButton>
          )
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title={t("common.details")}>
          <DetailList
            columns={2}
            items={[
              { label: t("f.matter"), value: <Link href={`/cases/${f.matterId}?tab=court`} className="text-primary hover:underline dark:text-accent">{f.matter.fileNo} — {localizedTitle(f.matter, locale)}</Link> },
              { label: t("f.reference"), value: f.reference && <span dir="ltr">{f.reference}</span> },
              { label: t("courts.submittedAt"), value: f.submittedAt && <DateText value={f.submittedAt} /> },
              { label: t("courts.responseDueAt"), value: f.responseDueAt && <DateText value={f.responseDueAt} /> },
              { label: t("courts.followUpAt"), value: f.followUpAt && <DateText value={f.followUpAt} /> },
              { label: t("courts.respondedAt"), value: f.respondedAt && <DateText value={f.respondedAt} /> },
              { label: t("f.assignee"), value: localized(f.assignee, locale) },
              { label: t("courts.response"), value: f.response },
              { label: t("f.notes"), value: f.notes },
            ]}
          />
        </Section>
        {can(user, "matters", "update") && (
          <Section title={t("common.edit")}>
            <EntityForm fields={await filingFields(user)} schema="filing" action={updateFiling.bind(null, id)} defaultValues={plain(f)} />
          </Section>
        )}
      </div>
    </>
  );
}
