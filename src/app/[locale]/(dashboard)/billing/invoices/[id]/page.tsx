import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Ban, Download, FileCheck2, Import, Trash2, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { plain } from "@/lib/plain";
import { can, requirePermission } from "@/lib/session";
import { balanceDue } from "@/lib/billing";
import { dec } from "@/lib/money";
import { getOffice } from "@/lib/settings";
import { localized, localizedTitle } from "@/lib/utils";
import { isoDate } from "@/lib/deadlines";
import { Link } from "@/i18n/navigation";
import { Badge, STATUS_TONES } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { ActionButton } from "@/components/action-button";
import { EntityForm } from "@/components/entity-form";
import { DateText, Money } from "@/components/format";
import { DetailList, PageHeader, Section } from "@/components/page";
import {
  addInvoiceLine,
  applyTrust,
  cancelInvoice,
  createCreditNote,
  deleteInvoice,
  deleteInvoiceLine,
  importUnbilled,
  issueInvoice,
  updateInvoice,
} from "@/server/billing/actions";
import { clientTrustBalance, invoiceScope, unbilledItems } from "@/server/billing/queries";
import { invoiceFields, lineDefaults, lineFields } from "../../fields";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("billing");
  const { id } = await params;
  const t = await getTranslations();
  const locale = await getLocale();
  const inv = await prisma.invoice.findFirst({
    where: { AND: [invoiceScope(user), { id }] },
    include: {
      client: true,
      matter: true,
      lines: { orderBy: { id: "asc" } },
      payments: { where: { deletedAt: null }, include: { bankAccount: true }, orderBy: { date: "asc" } },
      creditNotes: { orderBy: { date: "asc" } },
      trust: { where: { type: "APPLIED" }, orderBy: { date: "asc" } },
      quote: true,
    },
  });
  if (!inv) notFound();
  const office = await getOffice();
  const draft = inv.status === "DRAFT";
  const payable = inv.status === "ISSUED" || inv.status === "PARTIALLY_PAID";
  const canEdit = draft && can(user, "billing", "update");
  const due = balanceDue(inv);
  const cur = inv.currency;
  const [unbilled, trust] = await Promise.all([
    canEdit ? unbilledItems(inv.clientId, inv.matterId) : null,
    payable && cur === "AED" && can(user, "billing", "approve") ? clientTrustBalance(inv.clientId) : null,
  ]);
  const unbilledCount = unbilled ? unbilled.time.length + unbilled.expenses.length + unbilled.installments.length : 0;
  const settledNothing = dec(inv.paidAmount).isZero() && dec(inv.creditAmount).isZero();

  return (
    <>
      <PageHeader
        title={draft ? t("billing.draftInvoice") : `${t("billing.taxInvoice")} ${inv.number}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONES[inv.status]}>{t(`enum.InvoiceStatus.${inv.status}`)}</Badge>
            <Link href={`/clients/${inv.clientId}`} className="text-primary hover:underline dark:text-accent">
              {localized(inv.client, locale)}
            </Link>
            {inv.quote && (
              <Link href={`/billing/quotes/${inv.quote.id}`} className="hover:underline">
                · {t("billing.fromQuote", { number: inv.quote.number })}
              </Link>
            )}
          </span>
        }
        actions={
          <>
            <a href={`/api/pdf/invoice/${id}?locale=${locale}`} target="_blank" className={buttonVariants({ variant: "outline" })}>
              <Download /> {t("common.pdf")}
            </a>
            {payable && can(user, "billing", "create") && (
              <Link href={`/billing/payments/new?clientId=${inv.clientId}&invoiceId=${id}`} className={buttonVariants({ variant: "outline" })}>
                <Wallet /> {t("billing.recordPayment")}
              </Link>
            )}
            {payable && settledNothing && can(user, "billing", "approve") && (
              <ActionButton variant="outline" action={cancelInvoice.bind(null, id)} confirm={t("billing.confirmCancel")}>
                <Ban /> {t("billing.cancel")}
              </ActionButton>
            )}
            {draft && can(user, "billing", "delete") && (
              <ActionButton variant="destructive" action={deleteInvoice.bind(null, id)} confirm={t("common.confirmDelete")} redirectTo="/billing/invoices">
                <Trash2 /> {t("common.delete")}
              </ActionButton>
            )}
            {draft && can(user, "billing", "approve") && (
              <ActionButton action={issueInvoice.bind(null, id)} confirm={t("billing.confirmIssue")} disabled={!inv.lines.length}>
                <FileCheck2 /> {t("billing.issue")}
              </ActionButton>
            )}
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Section title={t("billing.lines")}>
            {inv.lines.length === 0 ? (
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
                  {inv.lines.map((l) => (
                    <tr key={l.id}>
                      <Td>
                        <Badge tone="neutral" className="me-2">
                          {t(`enum.LineType.${l.type}`)}
                        </Badge>
                        {l.description}
                      </Td>
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
                          <ActionButton variant="ghost" size="icon" action={deleteInvoiceLine.bind(null, l.id)} aria-label={t("common.delete")}>
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
                  <Money value={inv.subtotal.toString()} currency={cur} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>{t("f.vatAmount")}</dt>
                <dd>
                  <Money value={inv.vatAmount.toString()} currency={cur} />
                </dd>
              </div>
              <div className="flex justify-between border-t pt-1 font-bold">
                <dt>{t("f.total")}</dt>
                <dd>
                  <Money value={inv.total.toString()} currency={cur} />
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
                  action={addInvoiceLine.bind(null, id)}
                  defaultValues={await lineDefaults()}
                  fields={await lineFields()}
                  resetOnSuccess
                  submitLabel={t("common.add")}
                />
              </div>
            )}
          </Section>

          {canEdit && unbilled && (
            <Section
              title={t("billing.unbilled")}
              actions={
                unbilledCount > 0 && (
                  <ActionButton size="sm" action={importUnbilled.bind(null, id)}>
                    <Import /> {t("billing.importAll", { count: unbilledCount })}
                  </ActionButton>
                )
              }
            >
              {unbilledCount === 0 ? (
                <p className="text-sm text-muted-foreground">{t("billing.nothingUnbilled")}</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  <li>{t("billing.unbilledTime", { count: unbilled.time.length, hours: unbilled.hours.toFixed(2) })}</li>
                  <li>
                    {t("billing.unbilledExpenses", { count: unbilled.expenses.length })} — <Money value={unbilled.expenseTotal.toString()} />
                  </li>
                  <li>
                    {t("billing.unbilledInstallments", { count: unbilled.installments.length })} — <Money value={unbilled.installmentTotal.toString()} />
                  </li>
                </ul>
              )}
              <p className="mt-3 text-xs text-muted-foreground">{t("billing.unbilledHelp")}</p>
            </Section>
          )}
        </div>

        <div className="space-y-5">
          <Section title={t("common.details")}>
            <DetailList
              columns={2}
              items={[
                {
                  label: t("f.matter"),
                  value: inv.matter && (
                    <Link href={`/cases/${inv.matter.id}?tab=finance`} className="text-primary hover:underline dark:text-accent">
                      {inv.matter.fileNo} — {localizedTitle(inv.matter, locale)}
                    </Link>
                  ),
                },
                { label: t("f.trn"), value: inv.client.trn && <span dir="ltr">{inv.client.trn}</span> },
                { label: t("f.issueDate"), value: <DateText value={inv.issueDate} /> },
                { label: t("f.dueDate"), value: inv.dueDate && <DateText value={inv.dueDate} /> },
                { label: t("f.currency"), value: cur === "AED" ? cur : `${cur} × ${inv.exchangeRate.toString()}` },
                { label: t("f.notes"), value: inv.notes },
              ]}
            />
          </Section>

          {!draft && (
            <Section title={t("billing.settlement")}>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt>{t("f.total")}</dt>
                  <dd>
                    <Money value={inv.total.toString()} currency={cur} />
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>{t("f.paidAmount")}</dt>
                  <dd>
                    <Money value={inv.paidAmount.toString()} currency={cur} />
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>{t("billing.credited")}</dt>
                  <dd>
                    <Money value={inv.creditAmount.toString()} currency={cur} />
                  </dd>
                </div>
                <div className="flex justify-between border-t pt-1 font-bold">
                  <dt>{t("billing.balance")}</dt>
                  <dd>
                    <Money value={due.toString()} currency={cur} />
                  </dd>
                </div>
              </dl>
              {(inv.payments.length > 0 || inv.trust.length > 0 || inv.creditNotes.length > 0) && (
                <ul className="mt-4 divide-y border-t text-sm">
                  {inv.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                      <span>
                        <span className="font-medium">{p.number}</span>{" "}
                        · {t(`enum.PaymentMethod.${p.method}`)} · <DateText value={p.date} />
                        {p.chequeStatus && (
                          <Badge tone={STATUS_TONES[p.chequeStatus]} className="ms-2">
                            {t(`enum.ChequeStatus.${p.chequeStatus}`)}
                          </Badge>
                        )}
                      </span>
                      <span className="flex items-center gap-1">
                        <Money value={p.amount.toString()} currency={cur} />
                        {p.chequeStatus !== "BOUNCED" && (
                        <a
                          href={`/api/pdf/receipt/${p.id}?locale=${locale}`}
                          target="_blank"
                          className={buttonVariants({ variant: "ghost", size: "icon" })}
                          aria-label={t("billing.receipt")}
                          title={t("billing.receipt")}
                        >
                          <Download />
                        </a>
                        )}
                      </span>
                    </li>
                  ))}
                  {inv.trust.map((x) => (
                    <li key={x.id} className="flex items-center justify-between gap-2 py-2">
                      <span>
                        {t("billing.fromTrust")} · <DateText value={x.date} />
                      </span>
                      <Money value={x.amount.toString()} currency={cur} />
                    </li>
                  ))}
                  {inv.creditNotes.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                      <span>
                        {c.number} · {c.reason} · <DateText value={c.date} />
                      </span>
                      <span className="text-destructive">
                        -<Money value={c.total.toString()} currency={cur} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}

          {trust !== null && trust.greaterThan(0) && due.greaterThan(0) && (
            <Section title={t("billing.applyTrust")}>
              <p className="mb-3 text-sm">
                {t("billing.trustAvailable")} <Money value={trust.toString()} />
              </p>
              <EntityForm
                compact
                columns={1}
                schema="applyTrust"
                action={applyTrust.bind(null, id)}
                defaultValues={{ amount: (trust.lessThan(due) ? trust : due).toFixed(2) }}
                fields={[{ name: "amount", label: t("f.amount"), type: "money", required: true }]}
                submitLabel={t("billing.applyTrust")}
              />
            </Section>
          )}

          {payable && due.greaterThan(0) && can(user, "billing", "approve") && (
            <Section title={t("billing.creditNote")}>
              <EntityForm
                compact
                schema="creditNote"
                action={createCreditNote.bind(null, id)}
                defaultValues={{ date: isoDate(new Date()), vatRate: office.vatRate }}
                fields={[
                  { name: "amount", label: t("billing.creditNet"), type: "money", required: true },
                  { name: "vatRate", label: t("f.vatRate"), type: "number", required: true },
                  { name: "date", label: t("f.date"), type: "date", required: true },
                  { name: "reason", label: t("f.reason"), required: true },
                ]}
                submitLabel={t("billing.issueCreditNote")}
                resetOnSuccess
              />
            </Section>
          )}

          {canEdit && (
            <Section title={t("common.edit")}>
              <EntityForm compact fields={await invoiceFields(user, "invoice")} schema="invoice" action={updateInvoice.bind(null, id)} defaultValues={plain(inv)} />
            </Section>
          )}
        </div>
      </div>
    </>
  );
}
