import { getTranslations } from "next-intl/server";
import type { Field } from "@/components/entity-form";
import type { CurrentUser } from "@/lib/session";
import { clientOptions, enumOptions, matterOptions, userOptions } from "@/server/options";

export async function appointmentFields(user: CurrentUser, { withOutcome = false } = {}): Promise<Field[]> {
  const t = await getTranslations();
  const [kinds, statuses, prefs, clients, matters, users] = await Promise.all([
    enumOptions("AppointmentKind"),
    enumOptions("AppointmentStatus"),
    enumOptions("ContactPreference"),
    clientOptions(),
    matterOptions(user, {}),
    userOptions(),
  ]);
  return [
    { name: "title", label: t("f.title"), required: true, span: 2 },
    { name: "kind", label: t("f.type"), type: "select", options: kinds, required: true },
    { name: "status", label: t("f.status"), type: "select", options: statuses, required: true },
    { name: "startAt", label: t("appointments.start"), type: "datetime", required: true },
    { name: "endAt", label: t("appointments.end"), type: "datetime" },
    { name: "location", label: t("appointments.location") },
    { name: "onlineLink", label: t("appointments.onlineLink"), dir: "ltr", placeholder: "https://" },
    { name: "clientId", label: t("f.client"), type: "select", options: clients, help: t("tasks.clientHelp") },
    { name: "matterId", label: t("f.matter"), type: "select", options: matters },
    { name: "language", label: t("appointments.language"), type: "select", options: await enumOptions("Language") },
    { name: "contactPreference", label: t("appointments.contactPreference"), type: "select", options: prefs },
    { name: "attendeeIds", label: t("appointments.attendees"), type: "multiselect", options: users, span: 2, help: t("appointments.attendeesHelp") },
    { name: "notes", label: t("f.notes"), type: "textarea" },
    ...(withOutcome ? [{ name: "outcome", label: t("appointments.outcome"), type: "textarea" as const }] : []),
  ];
}
