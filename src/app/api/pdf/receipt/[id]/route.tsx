import { Text, View } from "@react-pdf/renderer";
import { getTranslations } from "next-intl/server";
import { HttpError, apiLocale, apiUser, withErrors } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getOffice } from "@/lib/settings";
import { localized } from "@/lib/utils";
import { paymentScope } from "@/server/billing/queries";
import { PdfShell, fmtDate, fmtMoney, loadLogo, pdfResponse, renderPdf, row, s } from "@/lib/pdf/base";

/** Receipt voucher for a payment received. */
export const GET = withErrors(async (req, { params }) => {
  const user = await apiUser("billing");
  const locale = apiLocale(req);
  const { id } = await params;
  const p = await prisma.payment.findFirst({ where: { AND: [paymentScope(user), { id }] }, include: { client: true, invoice: true, bankAccount: true } });
  if (!p) throw new HttpError(404);
  const t = await getTranslations({ locale });
  const office = await getOffice();
  const rtl = locale === "ar";
  const items: [string, string | null | undefined][] = [
    [t("f.number"), p.number],
    [t("f.date"), fmtDate(p.date, locale)],
    [t("billing.pdf.receivedFrom"), localized(p.client, locale)],
    [t("f.amount"), fmtMoney(p.amount.toString(), p.invoice?.currency ?? "AED", locale)],
    [t("f.method"), t(`enum.PaymentMethod.${p.method}`)],
    [t("f.chequeNo"), p.chequeNo],
    [t("f.chequeDate"), p.chequeDueDate && fmtDate(p.chequeDueDate, locale)],
    [t("f.bankAccount"), localized(p.bankAccount, locale)],
    [t("f.invoice"), p.invoice?.number ?? t("billing.onAccount")],
    [t("f.reference"), p.reference],
    [t("f.notes"), p.notes],
  ];
  const buf = await renderPdf(
    <PdfShell office={office} locale={locale} logo={await loadLogo(office)} title={t("billing.pdf.receipt")}>
      <View style={{ borderWidth: 1, borderColor: "#ddd", padding: 12, gap: 6 }}>
        {items
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <View key={k} style={[row(rtl), { gap: 8 }]}>
              <Text style={[s.muted, { width: "30%", fontSize: 10 }]}>{k}</Text>
              <Text style={{ fontSize: 11 }}>{v}</Text>
            </View>
          ))}
      </View>
      <View style={[row(rtl), { justifyContent: "space-between", marginTop: 48 }]}>
        <Text style={s.muted}>{t("billing.pdf.receivedBy")}: ____________________</Text>
        <Text style={s.muted}>{t("billing.pdf.signature")}: ____________________</Text>
      </View>
    </PdfShell>,
  );
  return pdfResponse(buf, `${p.number}.pdf`);
});
