import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/session";
import { EntityForm } from "@/components/entity-form";
import { PageHeader, Section } from "@/components/page";
import { createAppointment } from "@/server/appointments/actions";
import { appointmentFields } from "../fields";

export default async function NewAppointmentPage({ searchParams }: { searchParams: Promise<{ matterId?: string; clientId?: string; date?: string }> }) {
  const user = await requirePermission("hearings", "create");
  const t = await getTranslations();
  const sp = await searchParams;
  return (
    <>
      <PageHeader title={t("appointments.new")} />
      <Section>
        <EntityForm
          fields={await appointmentFields(user)}
          schema="appointment"
          action={createAppointment}
          defaultValues={{ kind: "CLIENT_MEETING", status: "SCHEDULED", matterId: sp.matterId, clientId: sp.clientId, startAt: sp.date ? `${sp.date.slice(0, 10)}T10:00:00` : undefined, attendeeIds: [user.id] }}
          redirectTo="/appointments/:id"
        />
      </Section>
    </>
  );
}
