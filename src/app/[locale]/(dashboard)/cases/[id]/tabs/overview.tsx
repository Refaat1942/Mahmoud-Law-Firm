import { getTranslations } from "next-intl/server";
import type { Court, Matter, MatterType, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { localized, localizedTitle } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { DateText, Money } from "@/components/format";
import { EntityForm } from "@/components/entity-form";
import { DetailList, Section } from "@/components/page";
import { addEvent } from "@/server/matters/actions";
import type { TabProps } from "./types";

type MatterWithRels = Matter & {
  court: Court | null;
  type: MatterType | null;
  responsible: User | null;
  parent: Matter | null;
  children: Matter[];
};

export async function OverviewTab({ matter, canEdit, locale }: TabProps & { matter: MatterWithRels }) {
  const t = await getTranslations();
  const events = await prisma.matterEvent.findMany({ where: { matterId: matter.id }, include: { user: true }, orderBy: { createdAt: "desc" }, take: 200 });
  const linked = [...(matter.parent ? [matter.parent] : []), ...matter.children];

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Section title={t("common.details")}>
          <DetailList
            items={[
              { label: t("f.matterType"), value: localized(matter.type, locale) },
              { label: t("f.level"), value: t(`enum.MatterLevel.${matter.level}`) },
              { label: t("f.court"), value: localized(matter.court, locale) },
              { label: t("f.courtCaseNo"), value: <span dir="ltr">{matter.courtCaseNo}</span> },
              { label: t("f.clientRole"), value: matter.clientRole },
              { label: t("f.responsible"), value: localized(matter.responsible, locale) },
              { label: t("f.stage"), value: matter.stage },
              { label: t("f.claimAmount"), value: matter.claimAmount ? <Money value={matter.claimAmount.toString()} /> : null },
              { label: t("f.openedAt"), value: <DateText value={matter.openedAt} /> },
              { label: t("f.closedAt"), value: matter.closedAt ? <DateText value={matter.closedAt} /> : null },
            ]}
          />
          {matter.description && <p className="mt-4 whitespace-pre-wrap border-t pt-4 text-sm">{matter.description}</p>}
        </Section>
        {linked.length > 0 && (
          <Section title={t("cases.linked")}>
            <ul className="space-y-1 text-sm">
              {linked.map((m) => (
                <li key={m.id}>
                  <Link href={`/cases/${m.id}`} className="text-primary hover:underline dark:text-accent">
                    {m.fileNo} — {localizedTitle(m, locale)} ({t(`enum.MatterLevel.${m.level}`)})
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      <Section title={t("cases.timeline")}>
        {canEdit && (
          <div className="mb-4 border-b pb-4">
            <EntityForm
              compact
              columns={1}
              schema="event"
              action={addEvent.bind(null, matter.id)}
              resetOnSuccess
              submitLabel={t("cases.addNote")}
              fields={[
                { name: "title", label: t("f.title"), required: true },
                { name: "details", label: t("f.details"), type: "textarea" },
              ]}
            />
          </div>
        )}
        <ol className="relative space-y-4 border-s ps-4">
          {events.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -start-[21px] top-1.5 size-2.5 rounded-full bg-accent" />
              <p className="text-sm font-medium">{e.title}</p>
              {e.details && <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">{e.details}</p>}
              <p className="mt-0.5 text-xs text-muted-foreground">
                <DateText value={e.createdAt} withTime /> {e.user && `· ${localized(e.user, locale)}`}
              </p>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}
