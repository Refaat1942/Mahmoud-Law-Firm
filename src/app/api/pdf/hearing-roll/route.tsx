import { getTranslations } from "next-intl/server";
import { apiLocale, apiUser, withErrors } from "@/lib/api";
import { getOffice } from "@/lib/settings";
import { localized } from "@/lib/utils";
import { isoDate } from "@/lib/deadlines";
import { PdfShell, PdfTable, fmtDate, loadLogo, pdfResponse, renderPdf } from "@/lib/pdf/base";
import { hearingRoll, rollColumns, type RollRange } from "@/server/hearings/queries";

export const GET = withErrors(async (req) => {
  const user = await apiUser("hearings");
  const locale = apiLocale(req);
  const sp = new URL(req.url).searchParams;
  const range: RollRange = sp.get("range") === "week" ? "week" : "day";
  const date = sp.get("date") || isoDate(new Date());
  const { from, to, rows } = await hearingRoll(user, date, range, sp.get("lawyer") || undefined);
  const t = await getTranslations({ locale });
  const office = await getOffice();
  const rtl = locale === "ar";
  const subtitle = range === "week" ? `${fmtDate(from, locale)} — ${fmtDate(new Date(to.getTime() - 1), locale)}` : fmtDate(from, locale);

  const buf = await renderPdf(
    <PdfShell office={office} locale={locale} logo={await loadLogo(office)} title={t("hearings.roll")} subtitle={`${subtitle} · ${t("hearings.rollCount", { count: rows.length })}`} landscape>
      <PdfTable
        rtl={rtl}
        rows={rows.map((h) => ({ h, c: rollColumns(h, locale) }))}
        columns={[
          {
            label: t("hearings.cols.courtCapacity"),
            width: 20,
            value: ({ h, c }) =>
              [
                c.court,
                c.capacity && t("hearings.capacity", { role: c.capacity }),
                fmtDate(h.date, locale, true),
                c.caseNo,
              ]
                .filter(Boolean)
                .join("\n"),
          },
          { label: t("hearings.cols.level"), width: 9, value: ({ c }) => t(`enum.MatterLevel.${c.level}`) },
          { label: t("hearings.cols.client"), width: 15, value: ({ c }) => c.client },
          { label: t("hearings.cols.opponent"), width: 15, value: ({ c }) => c.opponent },
          {
            label: t("hearings.cols.lastDecision"),
            width: 21,
            value: ({ c }) => [c.lastDecisionDate && fmtDate(c.lastDecisionDate, locale), c.lastDecision].filter(Boolean).join("\n"),
          },
          {
            label: t("hearings.cols.requests"),
            width: 20,
            value: ({ h, c }) => [c.requests, localized(h.lawyer, locale)].filter(Boolean).join("\n"),
          },
        ]}
      />
    </PdfShell>,
  );
  return pdfResponse(buf, `hearing-roll-${date}.pdf`);
});
