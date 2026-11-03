import { getTranslations } from "next-intl/server";
import { HttpError, apiLocale, apiUser, withErrors } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getOffice } from "@/lib/settings";
import { localized, localizedTitle } from "@/lib/utils";
import { PdfShell, fmtDate, loadLogo, pdfResponse, renderPdf } from "@/lib/pdf/base";
import { BillingDocument } from "@/lib/pdf/billing";
import { quoteScope } from "@/server/billing/queries";

export const GET = withErrors(async (req, { params }) => {
  const user = await apiUser("billing");
  const locale = apiLocale(req);
  const { id } = await params;
  const q = await prisma.quote.findFirst({ where: { AND: [quoteScope(user), { id }] }, include: { client: true, matter: true, lines: { orderBy: { id: "asc" } } } });
  if (!q) throw new HttpError(404);
  const t = await getTranslations({ locale });
  const office = await getOffice();
  const buf = await renderPdf(
    <PdfShell office={office} locale={locale} logo={await loadLogo(office)} title={t("billing.pdf.quote")}>
      <BillingDocument
        t={t}
        locale={locale}
        currency={q.currency}
        client={{ name: localized(q.client, locale), code: q.client.code, trn: q.client.trn, address: q.client.address }}
        meta={[
          [t("f.number"), q.number],
          [t("f.date"), fmtDate(q.date, locale)],
          [t("f.validUntil"), q.validUntil && fmtDate(q.validUntil, locale)],
          [t("f.matter"), q.matter && `${q.matter.fileNo} — ${localizedTitle(q.matter, locale)}`],
        ]}
        lines={q.lines}
        totals={[
          [t("f.subtotal"), q.subtotal],
          [t("f.vatAmount"), q.vatAmount],
          [t("f.total"), q.total, true],
        ]}
        notes={q.notes}
      />
    </PdfShell>,
  );
  return pdfResponse(buf, `${q.number}.pdf`);
});
