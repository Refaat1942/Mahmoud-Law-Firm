import { getLocale, getTranslations } from "next-intl/server";
import { FileDown } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { localized, localizedTitle } from "@/lib/utils";
import { isoDate } from "@/lib/deadlines";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { Badge, STATUS_TONES } from "@/components/ui/badge";
import { DateText } from "@/components/format";
import { PageHeader, Section } from "@/components/page";
import { hearingRoll, type RollRange } from "@/server/hearings/queries";
import { userOptions } from "@/server/options";

export default async function HearingRollPage({ searchParams }: { searchParams: Promise<{ date?: string; range?: string; lawyer?: string }> }) {
  const user = await requirePermission("hearings");
  const t = await getTranslations();
  const locale = await getLocale();
  const sp = await searchParams;
  const range: RollRange = sp.range === "week" ? "week" : "day";
  const date = sp.date || isoDate(new Date());
  const { rows } = await hearingRoll(user, date, range, sp.lawyer);
  const qs = new URLSearchParams({ date, range, locale, ...(sp.lawyer ? { lawyer: sp.lawyer } : {}) });

  return (
    <>
      <PageHeader
        title={t("hearings.roll")}
        subtitle={t("hearings.rollHelp")}
        actions={
          <a href={`/api/pdf/hearing-roll?${qs}`} target="_blank" className={buttonVariants()}>
            <FileDown /> {t("common.pdf")}
          </a>
        }
      />
      <Section>
        <form className="mb-4 flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">
            <span>{t("f.date")}</span>
            <Input type="date" name="date" defaultValue={date} className="w-44" />
          </label>
          <label className="space-y-1 text-sm">
            <span>{t("hearings.range")}</span>
            <Select name="range" defaultValue={range} className="w-36">
              <option value="day">{t("hearings.rangeDay")}</option>
              <option value="week">{t("hearings.rangeWeek")}</option>
            </Select>
          </label>
          <label className="space-y-1 text-sm">
            <span>{t("f.lawyer")}</span>
            <Select name="lawyer" defaultValue={sp.lawyer ?? ""} className="w-48">
              <option value="">{t("common.all")}</option>
              {(await userOptions()).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </label>
          <button className={buttonVariants({ variant: "outline" })}>{t("common.apply")}</button>
        </form>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("hearings.noHearings")}</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("f.dateTime")}</Th>
                <Th>{t("f.court")}</Th>
                <Th>{t("f.courtCaseNo")}</Th>
                <Th>{t("f.fileNo")}</Th>
                <Th>{t("f.client")}</Th>
                <Th>{t("hearings.opponent")}</Th>
                <Th>{t("hearings.lastDecision")}</Th>
                <Th>{t("f.purpose")}</Th>
                <Th>{t("f.lawyer")}</Th>
                <Th>{t("f.status")}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((h) => (
                <tr key={h.id}>
                  <Td className="whitespace-nowrap">
                    <Link href={`/hearings/${h.id}`} className="text-primary hover:underline dark:text-accent">
                      <DateText value={h.date} withTime />
                    </Link>
                  </Td>
                  <Td>
                    {localized(h.court, locale)} {h.room && <span className="text-muted-foreground">({h.room})</span>}
                  </Td>
                  <Td dir="ltr">{h.matter.courtCaseNo}</Td>
                  <Td>
                    <Link href={`/cases/${h.matterId}`} className="hover:underline" title={localizedTitle(h.matter, locale)}>
                      {h.matter.fileNo}
                    </Link>
                  </Td>
                  <Td>{localized(h.matter.client, locale)}</Td>
                  <Td>
                    {h.matter.parties
                      .filter((p) => p.role === "OPPONENT")
                      .map((p) => localized(p.party, locale))
                      .join("، ")}
                  </Td>
                  <Td className="max-w-56 truncate">{h.previous?.decision}</Td>
                  <Td>{h.purpose}</Td>
                  <Td>{localized(h.lawyer, locale)}</Td>
                  <Td>
                    <Badge tone={STATUS_TONES[h.status]}>{t(`enum.HearingStatus.${h.status}`)}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>
    </>
  );
}
