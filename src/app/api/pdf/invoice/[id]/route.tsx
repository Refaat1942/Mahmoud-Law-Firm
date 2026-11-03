import { getTranslations } from "next-intl/server";
import { HttpError, apiLocale, apiUser, withErrors } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getOffice } from "@/lib/settings";
import { balanceDue } from "@/lib/billing";
import { localized, localizedTitle } from "@/lib/utils";
import { PdfShell, fmtDate, loadLogo, pdfResponse, renderPdf } from "@/lib/pdf/base";
import { BillingDocument } from "@/lib/pdf/billing";
import { invoiceScope } from "@/server/billing/queries";

export const GET = withErrors(async (req, { params }) => {
  const user = await apiUser("billing");
  const locale = apiLocale(req);
  const { id } = await params;
  const inv = await prisma.invoice.findFirst({ where: { AND: [invoiceScope(user), { id }] }, include: { client: true, matter: true, lines: { orderBy: { id: "asc" } } } });
  if (!inv) throw new HttpError(404);
  const t = await getTranslations({ locale });
  const office = await getOffice();
  const draft = inv.status === "DRAFT";
  const title = draft ? t("billing.pdf.draftTitle") : t("billing.pdf.taxInvoice");

  const buf = await renderPdf(
    <PdfShell office={office} locale={locale} logo={await loadLogo(office)} title={title} subtitle={inv.status === "CANCELLED" ? t("enum.InvoiceStatus.CANCELLED") : undefined}>
      <BillingDocument
        t={t}
        locale={locale}
        currency={inv.currency}
        client={{ name: localized(inv.client, locale), code: inv.client.code, trn: inv.client.trn, address: inv.client.address }}
        meta={[
          [t("f.number"), draft ? t("billing.draft") : inv.number],
          [t("f.issueDate"), fmtDate(inv.issueDate, locale)],
          [t("f.dueDate"), inv.dueDate && fmtDate(inv.dueDate, locale)],
          [t("f.matter"), inv.matter && `${inv.matter.fileNo} — ${localizedTitle(inv.matter, locale)}`],
          [t("f.currency"), inv.currency],
        ]}
        lines={inv.lines}
        totals={[
          [t("f.subtotal"), inv.subtotal],
          [t("f.vatAmount"), inv.vatAmount],
          [t("f.total"), inv.total, true],
          ...(!draft && (!inv.paidAmount.isZero() || !inv.creditAmount.isZero())
            ? ([
                [t("f.paidAmount"), inv.paidAmount],
                [t("billing.credited"), inv.creditAmount],
                [t("billing.balance"), balanceDue(inv), true],
              ] as [string, typeof inv.total, boolean?][])
            : []),
        ]}
        notes={inv.notes}
      />
    </PdfShell>,
  );
  return pdfResponse(buf, `${draft ? "draft-invoice" : inv.number}.pdf`);
});
