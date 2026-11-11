import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ExternalLink, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/session";
import { localized, localizedTitle } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { Badge, STATUS_TONES } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ActionButton } from "@/components/action-button";
import { EntityForm } from "@/components/entity-form";
import { DateText } from "@/components/format";
import { DetailList, PageHeader, Section } from "@/components/page";
import { deleteAppointment, updateAppointment } from "@/server/appointments/actions";
import { appointmentScope } from "@/server/appointments/queries";
import { appointmentFields } from "../fields";

export default async function AppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("hearings");
  const { id } = await params;
  const t = await getTranslations();
  const locale = await getLocale();
  const a = await prisma.appointment.findFirst({
    where: { AND: [appointmentScope(user), { id }] },
    include: { client: true, matter: true, organizer: true, attendees: { include: { user: true } } },
  });
  if (!a) notFound();
  return (
    <>
      <PageHeader
        title={a.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{t(`enum.AppointmentKind.${a.kind}`)}</Badge>
            <Badge tone={STATUS_TONES[a.status] ?? "neutral"}>{t(`enum.AppointmentStatus.${a.status}`)}</Badge>
            <DateText value={a.startAt} withTime />
          </span>
        }
        actions={
          <>
            {a.onlineLink && (
              <a href={a.onlineLink} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline" })}>
                <ExternalLink /> {t("appointments.join")}
              </a>
            )}
            {can(user, "hearings", "delete") && (
              <ActionButton variant="destructive" action={deleteAppointment.bind(null, id)} confirm={t("common.confirmDelete")} redirectTo="/appointments">
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
              { label: t("appointments.end"), value: a.endAt && <DateText value={a.endAt} withTime /> },
              { label: t("appointments.location"), value: a.location },
              { label: t("f.client"), value: a.client && <Link href={`/clients/${a.client.id}`} className="text-primary hover:underline dark:text-accent">{localized(a.client, locale)}</Link> },
              { label: t("f.matter"), value: a.matter && <Link href={`/cases/${a.matter.id}`} className="text-primary hover:underline dark:text-accent">{a.matter.fileNo} — {localizedTitle(a.matter, locale)}</Link> },
              { label: t("appointments.language"), value: a.language && t(`enum.Language.${a.language}`) },
              { label: t("appointments.contactPreference"), value: a.contactPreference && t(`enum.ContactPreference.${a.contactPreference}`) },
              { label: t("appointments.organizer"), value: localized(a.organizer, locale) },
              { label: t("appointments.attendees"), value: a.attendees.map((x) => localized(x.user, locale)).join("، ") },
              { label: t("f.notes"), value: a.notes },
              { label: t("appointments.outcome"), value: a.outcome },
            ]}
          />
        </Section>
        {can(user, "hearings", "update") && (
          <Section title={t("common.edit")}>
            <EntityForm
              fields={await appointmentFields(user, { withOutcome: true })}
              schema="appointment"
              action={updateAppointment.bind(null, id)}
              defaultValues={{ ...a, startAt: a.startAt.toISOString(), endAt: a.endAt?.toISOString(), attendeeIds: a.attendees.map((x) => x.userId) }}
            />
          </Section>
        )}
      </div>
    </>
  );
}
