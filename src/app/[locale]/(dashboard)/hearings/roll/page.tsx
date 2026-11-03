import { getLocale, getTranslations } from "next-intl/server";
import { FileDown } from "lucide-react";
import { requirePermission } from "@/lib/session";
import { addDays, cn, localized } from "@/lib/utils";
import { isoDate } from "@/lib/deadlines";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { DateText } from "@/components/format";
import { PageHeader, Section } from "@/components/page";
import { hearingRoll, rollColumns, type RollRange } from "@/server/hearings/queries";
import { userOptions } from "@/server/options";

export default async function HearingRollPage({ searchParams }: { searchParams: Promise<{ date?: string; range?: string; lawyer?: string }> }) {
  const user = await requirePermission("hearings");
  const t = await getTranslations();
  const locale = await getLocale();
  const sp = await searchParams;
  const range: RollRange = sp.range === "week" ? "week" : "day";
  const today = new Date();
  const date = sp.date || isoDate(today);
  const { rows } = await hearingRoll(user, date, range, sp.lawyer);
  const qs = new URLSearchParams({ date, range, locale, ...(sp.lawyer ? { lawyer: sp.lawyer } : {}) });
  const quick = [
    { key: "today", date: isoDate(today) },
    { key: "tomorrow", date: isoDate(addDays(today, 1)) },
    { key: "afterTomorrow", date: isoDate(addDays(today, 2)) },
  ];
  const dayHref = (d: string) => `/hearings/roll?${new URLSearchParams({ date: d, range: "day", ...(sp.lawyer ? { lawyer: sp.lawyer } : {}) })}`;

  return (
    <>
      <PageHeader
        title={t("hearings.roll")}
        subtitle={t("hearings.rollHelp")}
        actions={
          <a href={`/api/pdf/hearing-roll?${qs}`} target="_blank" className={buttonVariants()}>
            <FileDown /> {t("hearings.rollPdf")}
          </a>
        }
      />
      <Section>
        <div className="no-print mb-3 flex flex-wrap gap-2">
          {quick.map((q) => (
            <Link
              key={q.key}
              href={dayHref(q.date)}
              className={buttonVariants({ variant: range === "day" && date === q.date ? "default" : "outline", size: "sm" })}
            >
              {t(`hearings.quick.${q.key}`)}
            </Link>
          ))}
        </div>
        <form className="no-print mb-4 flex flex-wrap items-end gap-3">
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
        <p className="mb-3 text-sm font-medium">
          {range === "day" ? (
            <>
              {t("hearings.rollFor")} <DateText value={`${date}T12:00:00`} /> · {t("hearings.rollCount", { count: rows.length })}
            </>
          ) : (
            t("hearings.rollCount", { count: rows.length })
          )}
        </p>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("hearings.noHearings")}</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("hearings.cols.courtCapacity")}</Th>
                <Th>{t("hearings.cols.level")}</Th>
                <Th>{t("hearings.cols.client")}</Th>
                <Th>{t("hearings.cols.opponent")}</Th>
                <Th>{t("hearings.cols.lastDecision")}</Th>
                <Th>{t("hearings.cols.requests")}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((h) => {
                const c = rollColumns(h, locale);
                return (
                  <tr key={h.id} className="align-top">
                    <Td>
                      <Link href={`/hearings/${h.id}`} className="font-medium text-primary hover:underline dark:text-accent">
                        {c.court || "—"}
                      </Link>
                      {c.capacity && <p className="text-xs">{t("hearings.capacity", { role: c.capacity })}</p>}
                      <p className="text-xs text-muted-foreground">
                        <DateText value={h.date} withTime />
                        {c.caseNo && (
                          <>
                            {" · "}
                            <span dir="ltr">{c.caseNo}</span>
                          </>
                        )}
                        {" · "}
                        <Link href={`/cases/${h.matterId}`} className="hover:underline">
                          {h.matter.fileNo}
                        </Link>
                      </p>
                    </Td>
                    <Td className="whitespace-nowrap">{t(`enum.MatterLevel.${c.level}`)}</Td>
                    <Td>{c.client}</Td>
                    <Td>{c.opponent}</Td>
                    <Td className="max-w-72">
                      {c.lastDecisionDate && (
                        <p className="text-xs text-muted-foreground">
                          <DateText value={c.lastDecisionDate} />
                        </p>
                      )}
                      <p className={cn("whitespace-pre-wrap", !c.lastDecision && "text-muted-foreground")}>{c.lastDecision || "—"}</p>
                    </Td>
                    <Td className="max-w-72 whitespace-pre-wrap">
                      {c.requests || "—"}
                      {h.lawyer && <p className="mt-1 text-xs text-muted-foreground">{localized(h.lawyer, locale)}</p>}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Section>
    </>
  );
}
