import { getLocale, getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/session";
import { localized, startOfDay } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { PageHeader, Tabs } from "@/components/page";
import { enumOptions } from "@/server/options";
import { appointmentScope } from "@/server/appointments/queries";

const TABS = ["upcoming", "mine", "past"] as const;

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requirePermission("hearings");
  const t = await getTranslations();
  const locale = await getLocale();
  const requested = (await searchParams).tab;
  const tab = TABS.find((x) => x === requested) ?? "upcoming";
  const today = startOfDay();
  const filter =
    tab === "past"
      ? { startAt: { lt: today } }
      : tab === "mine"
        ? { startAt: { gte: today }, OR: [{ organizerId: user.id }, { attendees: { some: { userId: user.id } } }] }
        : { startAt: { gte: today } };
  const rows = await prisma.appointment.findMany({
    where: { AND: [appointmentScope(user), filter] },
    include: { client: true, matter: true, organizer: true, attendees: { include: { user: true } } },
    orderBy: { startAt: tab === "past" ? "desc" : "asc" },
    take: 1000,
  });
  return (
    <>
      <PageHeader
        title={t("appointments.title")}
        actions={
          can(user, "hearings", "create") && (
            <Link href="/appointments/new" className={buttonVariants()}>
              <Plus /> {t("appointments.new")}
            </Link>
          )
        }
      />
      <Tabs base="/appointments" active={tab} tabs={TABS.map((key) => ({ key, label: t(`appointments.tabs.${key}`) }))} />
      <DataTable
        exportName={`appointments-${tab}`}
        emptyText={t("appointments.empty")}
        filters={[
          { key: "kind", label: t("f.type"), options: await enumOptions("AppointmentKind") },
          { key: "status", label: t("f.status"), options: await enumOptions("AppointmentStatus") },
        ]}
        columns={[
          { key: "startAt", label: t("appointments.start"), type: "datetime", href: "/appointments/:id" },
          { key: "title", label: t("f.title"), href: "/appointments/:id" },
          { key: "kind", label: t("f.type"), type: "badge", enumKey: "AppointmentKind" },
          { key: "client", label: t("f.client") },
          { key: "matter", label: t("f.matter"), href: "/cases/:matterId" },
          { key: "location", label: t("appointments.location") },
          { key: "people", label: t("appointments.attendees") },
          { key: "status", label: t("f.status"), type: "badge", enumKey: "AppointmentStatus" },
        ]}
        rows={rows.map((a) => ({
          id: a.id,
          startAt: a.startAt.toISOString(),
          title: a.title,
          kind: a.kind,
          client: localized(a.client, locale),
          matter: a.matter?.fileNo ?? "",
          matterId: a.matterId ?? "",
          location: a.location ?? (a.onlineLink ? t("appointments.online") : ""),
          people: [a.organizer, ...a.attendees.map((x) => x.user)].map((u) => localized(u, locale)).filter((v, i, arr) => arr.indexOf(v) === i).join("، "),
          status: a.status,
        }))}
      />
    </>
  );
}
