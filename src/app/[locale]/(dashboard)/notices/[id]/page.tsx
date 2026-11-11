import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { plain } from "@/lib/plain";
import { can, requirePermission } from "@/lib/session";
import { daysUntil } from "@/lib/deadlines";
import { localized, localizedTitle } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { Badge, STATUS_TONES } from "@/components/ui/badge";
import { ActionButton } from "@/components/action-button";
import { EntityForm } from "@/components/entity-form";
import { DateText } from "@/components/format";
import { DetailList, PageHeader, Section } from "@/components/page";
import { deleteNotice, updateNotice } from "@/server/notices/actions";
import { noticeScope } from "@/server/notices/queries";
import { noticeFields } from "../fields";

export default async function NoticePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("matters");
  const { id } = await params;
  const t = await getTranslations();
  const locale = await getLocale();
  const n = await prisma.legalNotice.findFirst({ where: { AND: [noticeScope(user), { id }] }, include: { client: true, matter: true, assignee: true } });
  if (!n) notFound();
  const left = n.dueDate ? daysUntil(n.dueDate) : null;
  return (
    <>
      <PageHeader
        title={n.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{t(`enum.NoticeDirection.${n.direction}`)}</Badge>
            <Badge tone={STATUS_TONES[n.status] ?? (n.status === "DELIVERED" ? "success" : n.status === "REFUSED" || n.status === "FAILED" ? "danger" : "neutral")}>
              {t(`enum.NoticeStatus.${n.status}`)}
            </Badge>
            {left !== null && (left < 0 ? <Badge tone="danger">{t("notices.expired")}</Badge> : <Badge tone={left <= 3 ? "warning" : "info"}>{t("clients.daysLeft", { days: left })}</Badge>)}
          </span>
        }
        actions={
          can(user, "matters", "delete") && (
            <ActionButton variant="destructive" action={deleteNotice.bind(null, id)} confirm={t("common.confirmDelete")} redirectTo="/notices">
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
              { label: t("f.client"), value: <Link href={`/clients/${n.clientId}`} className="text-primary hover:underline dark:text-accent">{localized(n.client, locale)}</Link> },
              { label: t("f.matter"), value: n.matter && <Link href={`/cases/${n.matter.id}?tab=deadlines`} className="text-primary hover:underline dark:text-accent">{n.matter.fileNo} — {localizedTitle(n.matter, locale)}</Link> },
              { label: t("notices.counterparty"), value: n.counterparty },
              { label: t("notices.method"), value: t(`enum.NoticeMethod.${n.method}`) },
              { label: t("f.reference"), value: n.reference && <span dir="ltr">{n.reference}</span> },
              { label: t("f.assignee"), value: localized(n.assignee, locale) },
              { label: t("notices.sentAt"), value: n.sentAt && <DateText value={n.sentAt} /> },
              { label: t("notices.servedAt"), value: n.servedAt && <DateText value={n.servedAt} /> },
              { label: t("notices.graceDays"), value: n.graceDays },
              { label: t("notices.dueDate"), value: n.dueDate && <DateText value={n.dueDate} /> },
              { label: t("notices.acknowledgedAt"), value: n.acknowledgedAt && <DateText value={n.acknowledgedAt} /> },
              { label: t("f.notes"), value: n.notes },
            ]}
          />
          <p className="mt-4 text-xs text-muted-foreground">{t("notices.verifyHelp")}</p>
        </Section>
        {can(user, "matters", "update") && (
          <Section title={t("common.edit")}>
            <EntityForm fields={await noticeFields(user)} schema="notice" action={updateNotice.bind(null, id)} defaultValues={plain(n)} />
          </Section>
        )}
      </div>
    </>
  );
}
