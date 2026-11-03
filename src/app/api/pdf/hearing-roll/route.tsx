import { getTranslations } from "next-intl/server";
import { apiLocale, apiUser, withErrors } from "@/lib/api";
import { getOffice } from "@/lib/settings";
import { localized } from "@/lib/utils";
import { isoDate } from "@/lib/deadlines";
import { PdfShell, PdfTable, fmtDate, loadLogo, pdfResponse, renderPdf } from "@/lib/pdf/base";
import { hearingRoll, type RollRange } from "@/server/hearings/queries";

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
    <PdfShell office={office} locale={locale} logo={await loadLogo(office)} title={t("hearings.roll")} subtitle={subtitle} landscape>
      <PdfTable
        rtl={rtl}
        rows={rows}
        columns={[
          { label: t("f.dateTime"), width: 11, value: (h) => fmtDate(h.date, locale, true) },
          { label: t("f.court"), width: 14, value: (h) => [localized(h.court, locale), h.room].filter(Boolean).join(" / ") },
          { label: t("f.courtCaseNo"), width: 10, value: (h) => h.matter.courtCaseNo ?? "" },
          { label: t("f.fileNo"), width: 9, value: (h) => h.matter.fileNo },
          { label: t("f.client"), width: 13, value: (h) => localized(h.matter.client, locale) },
          {
            label: t("hearings.opponent"),
            width: 13,
            value: (h) =>
              h.matter.parties
                .filter((p) => p.role === "OPPONENT")
                .map((p) => localized(p.party, locale))
                .join("، "),
          },
          { label: t("hearings.lastDecision"), width: 12, value: (h) => h.previous?.decision ?? "" },
          { label: t("f.purpose"), width: 10, value: (h) => h.purpose ?? "" },
          { label: t("f.lawyer"), width: 8, value: (h) => localized(h.lawyer, locale) },
        ]}
      />
    </PdfShell>,
  );
  return pdfResponse(buf, `hearing-roll-${date}.pdf`);
});
