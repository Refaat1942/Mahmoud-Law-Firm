import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { localized, localizedTitle } from "@/lib/utils";
import { Badge, STATUS_TONES } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { DateText } from "@/components/format";
import { DetailList, PageHeader, Section } from "@/components/page";

export default async function PortalCasePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const t = await getTranslations();
  const locale = await getLocale();
  const m = await prisma.matter.findFirst({
    where: { id, clientId: user.clientId!, deletedAt: null },
    include: {
      court: true,
      type: true,
      responsible: true,
      hearings: { where: { deletedAt: null }, include: { court: true }, orderBy: { date: "desc" } },
      documents: { where: { deletedAt: null, visibleToClient: true }, include: { versions: { orderBy: { version: "desc" }, take: 1 } }, orderBy: { updatedAt: "desc" } },
    },
  });
  if (!m) notFound();
  return (
    <>
      <PageHeader
        title={localizedTitle(m, locale)}
        subtitle={
          <span className="flex items-center gap-2">
            {m.fileNo} <Badge tone={STATUS_TONES[m.status]}>{t(`enum.MatterStatus.${m.status}`)}</Badge>
          </span>
        }
      />
      <div className="grid gap-5 lg:grid-cols-3">
        <Section title={t("common.details")}>
          <DetailList
            columns={2}
            items={[
              { label: t("f.court"), value: localized(m.court, locale) },
              { label: t("f.courtCaseNo"), value: m.courtCaseNo && <span dir="ltr">{m.courtCaseNo}</span> },
              { label: t("f.level"), value: t(`enum.MatterLevel.${m.level}`) },
              { label: t("f.matterType"), value: localized(m.type, locale) },
              { label: t("f.responsible"), value: localized(m.responsible, locale) },
              { label: t("f.stage"), value: m.stage },
            ]}
          />
        </Section>
        <Section title={t("nav.hearings")} className="lg:col-span-2">
          {m.hearings.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>{t("f.dateTime")}</Th>
                  <Th>{t("f.court")}</Th>
                  <Th>{t("f.decision")}</Th>
                  <Th>{t("f.status")}</Th>
                </tr>
              </thead>
              <tbody>
                {m.hearings.map((h) => (
                  <tr key={h.id}>
                    <Td className="whitespace-nowrap">
                      <DateText value={h.date} withTime />
                    </Td>
                    <Td>{localized(h.court, locale)}</Td>
                    <Td>{h.decision}</Td>
                    <Td>
                      <Badge tone={STATUS_TONES[h.status]}>{t(`enum.HearingStatus.${h.status}`)}</Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Section>
        <Section title={t("portal.sharedDocuments")} className="lg:col-span-3">
          {m.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("portal.noDocuments")}</p>
          ) : (
            <ul className="divide-y text-sm">
              {m.documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                  <span>{d.name}</span>
                  {d.versions[0] && (
                    <a href={`/api/documents/${d.versions[0].id}`} className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label={t("common.download")}>
                      <Download />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
