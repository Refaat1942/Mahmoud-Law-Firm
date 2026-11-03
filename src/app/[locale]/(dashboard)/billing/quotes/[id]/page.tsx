import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Check, Download, FileOutput, Send, Trash2, X } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { plain } from "@/lib/plain";
import { can, requirePermission } from "@/lib/session";
import { localized, localizedTitle } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { Badge, STATUS_TONES } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { ActionButton } from "@/components/action-button";
import { EntityForm } from "@/components/entity-form";
import { DateText, Money } from "@/components/format";
import { DetailList, PageHeader, Section } from "@/components/page";
import { addQuoteLine, convertQuote, deleteQuote, deleteQuoteLine, setQuoteStatus, updateQuote } from "@/server/billing/actions";
import { quoteScope } from "@/server/billing/queries";
import { invoiceFields, lineDefaults, lineFields } from "../../fields";

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("billing");
  const { id } = await params;
  const t = await getTranslations();
  const locale = await getLocale();
  const q = await prisma.quote.findFirst({ where: { AND: [quoteScope(user), { id }] }, include: { client: true, matter: true, lines: { orderBy: { id: "asc" } }, invoice: true } });
  if (!q) notFound();
  const open = q.status !== "CONVERTED";
  const canEdit = open && can(user, "billing", "update");
  const status = setQuoteStatus.bind(null, id);
  const cur = q.currency;

  return (
    <>
      <PageHeader
        title={`${t("billing.quote")} ${q.number}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONES[q.status]}>{t(`enum.QuoteStatus.${q.status}`)}</Badge>
            <Link href={`/clients/${q.clientId}`} className="text-primary hover:underline dark:text-accent">
              {localized(q.client, locale)}
            </Link>
            {q.invoice && (
              <Link href={`/billing/invoices/${q.invoice.id}`} className="hover:underline">
                → {q.invoice.status === "DRAFT" ? t("billing.draftInvoice") : q.invoice.number}
              </Link>
            )}
          </span>
        }
        actions={
          <>
            <a href={`/api/pdf/quote/${id}?locale=${locale}`} target="_blank" className={buttonVariants({ variant: "outline" })}>
              <Download /> {t("common.pdf")}
            </a>
            {canEdit && q.status === "DRAFT" && (
              <ActionButton variant="outline" action={status} payload={{ status: "SENT" }}>
                <Send /> {t("billing.markSent")}
              </ActionButton>
            )}
            {canEdit && (q.status === "SENT" || q.status === "DRAFT") && (
              <>
                <ActionButton variant="outline" action={status} payload={{ status: "REJECTED" }}>
                  <X /> {t("enum.QuoteStatus.REJECTED")}
                </ActionButton>
                <ActionButton variant="outline" action={status} payload={{ status: "ACCEPTED" }}>
                  <Check /> {t("enum.QuoteStatus.ACCEPTED")}
                </ActionButton>
              </>
            )}
            {open && can(user, "billing", "create") && q.lines.length > 0 && (
              <ActionButton action={convertQuote.bind(null, id)} redirectTo="/billing/invoices/:id">
                <FileOutput /> {t("billing.convert")}
              </ActionButton>
            )}
            {open && can(user, "billing", "delete") && (
              <ActionButton variant="destructive" action={deleteQuote.bind(null, id)} confirm={t("common.confirmDelete")} redirectTo="/billing/quotes">
                <Trash2 /> {t("common.delete")}
              </ActionButton>
            )}
          </>
        }
      />
      <div className="grid gap-5 xl:grid-cols-3">
        <Section title={t("billing.lines")} className="xl:col-span-2">
          {q.lines.length === 0 ? (
            <p className="mb-4 text-sm text-muted-foreground">{t("billing.noLines")}</p>
          ) : (
            <Table className="mb-4">
              <thead>
                <tr>
                  <Th>{t("f.description")}</Th>
                  <Th>{t("f.quantity")}</Th>
                  <Th>{t("f.unitPrice")}</Th>
                  <Th>{t("f.vatRate")}</Th>
                  <Th>{t("f.amount")}</Th>
                  {canEdit && <Th />}
                </tr>
              </thead>
              <tbody>
                {q.lines.map((l) => (
                  <tr key={l.id}>
                    <Td>{l.description}</Td>
                    <Td className="tabular-nums">{l.quantity.toString()}</Td>
                    <Td>
                      <Money value={l.unitPrice.toString()} currency={cur} />
                    </Td>
                    <Td className="tabular-nums">{l.vatRate.toString()}%</Td>
                    <Td>
                      <Money value={l.amount.toString()} currency={cur} />
                    </Td>
                    {canEdit && (
                      <Td>
                        <ActionButton variant="ghost" size="icon" action={deleteQuoteLine.bind(null, l.id)} aria-label={t("common.delete")}>
                          <Trash2 />
                        </ActionButton>
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <dl className="ms-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <dt>{t("f.subtotal")}</dt>
              <dd>
                <Money value={q.subtotal.toString()} currency={cur} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>{t("f.vatAmount")}</dt>
              <dd>
                <Money value={q.vatAmount.toString()} currency={cur} />
              </dd>
            </div>
            <div className="flex justify-between border-t pt-1 font-bold">
              <dt>{t("f.total")}</dt>
              <dd>
                <Money value={q.total.toString()} currency={cur} />
              </dd>
            </div>
          </dl>
          {canEdit && (
            <div className="mt-5 border-t pt-4">
              <h3 className="mb-3 text-sm font-semibold">{t("billing.addLine")}</h3>
              <EntityForm
                compact
                columns={4}
                schema="line"
                action={addQuoteLine.bind(null, id)}
                defaultValues={await lineDefaults()}
                fields={await lineFields()}
                resetOnSuccess
                submitLabel={t("common.add")}
              />
            </div>
          )}
        </Section>
        <div className="space-y-5">
          <Section title={t("common.details")}>
            <DetailList
              columns={2}
              items={[
                { label: t("f.matter"), value: q.matter && `${q.matter.fileNo} — ${localizedTitle(q.matter, locale)}` },
                { label: t("f.date"), value: <DateText value={q.date} /> },
                { label: t("f.validUntil"), value: q.validUntil && <DateText value={q.validUntil} /> },
                { label: t("f.notes"), value: q.notes },
              ]}
            />
          </Section>
          {canEdit && (
            <Section title={t("common.edit")}>
              <EntityForm compact fields={await invoiceFields(user, "quote")} schema="quote" action={updateQuote.bind(null, id)} defaultValues={plain(q)} />
            </Section>
          )}
        </div>
      </div>
    </>
  );
}
