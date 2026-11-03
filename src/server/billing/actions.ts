"use server";

import { randomUUID } from "node:crypto";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { ActionError, defineAction } from "@/lib/action";
import { prisma, type Tx } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import { getOffice } from "@/lib/settings";
import { nextNumber } from "@/lib/sequence";
import { computeLine } from "@/lib/vat";
import { dec, round2, sum } from "@/lib/money";
import { ACC, deleteEntriesFor, invoiceLines, postEntry } from "@/lib/journal";
import { balanceDue, creditNoteTotals, toAed } from "@/lib/billing";
import { isoDate } from "@/lib/deadlines";
import { assertMatterAccess } from "../matters/access";
import { clientTrustBalance, invoiceScope, quoteScope, recalcInvoice, recalcQuote, unbilledItems } from "./queries";
import { applyTrustSchema, creditNoteSchema, invoiceSchema, lineSchema, paymentSchema, quoteSchema, trustSchema } from "./schema";

const draftNumber = () => `DRAFT-${randomUUID().slice(0, 8).toUpperCase()}`;

async function findInvoice(user: CurrentUser, id: string, tx: Tx = prisma) {
  const inv = await tx.invoice.findFirst({ where: { AND: [invoiceScope(user), { id }] } });
  if (!inv) throw new ActionError("errors.notFound");
  return inv;
}

async function findDraft(user: CurrentUser, id: string) {
  const inv = await findInvoice(user, id);
  if (inv.status !== "DRAFT") throw new ActionError("billing.notDraft");
  return inv;
}

/** A case must belong to the selected client and be reachable by the user. */
async function checkMatter(user: CurrentUser, clientId: string, matterId?: string) {
  if (!matterId) return;
  await assertMatterAccess(user, matterId);
  const m = await prisma.matter.findUniqueOrThrow({ where: { id: matterId }, select: { clientId: true } });
  if (m.clientId !== clientId) throw new ActionError("billing.matterClient");
}

async function bankAccountFor(bankAccountId: string, tx: Tx) {
  const bank = await tx.bankAccount.findUnique({ where: { id: bankAccountId } });
  if (!bank || !bank.isActive) throw new ActionError("errors.notFound");
  return bank;
}

const lineData = (l: { type: "TIME" | "EXPENSE" | "FEE" | "OTHER"; description: string; quantity: number | string; unitPrice: number | string; vatRate: number | string }) => {
  const c = computeLine(l);
  return { type: l.type, description: l.description, quantity: dec(l.quantity), unitPrice: dec(l.unitPrice), vatRate: dec(l.vatRate), amount: c.amount, vatAmount: c.vatAmount };
};

/** Detaches whatever an invoice line was imported from so it can be billed again. */
async function releaseSource(tx: Tx, line: { sourceType: string | null; sourceId: string | null }) {
  if (!line.sourceId) return;
  if (line.sourceType === "time") await tx.timeEntry.update({ where: { id: line.sourceId }, data: { invoiceId: null, status: "APPROVED" } });
  if (line.sourceType === "expense") await tx.expense.update({ where: { id: line.sourceId }, data: { invoiceId: null } });
  if (line.sourceType === "installment") await tx.feeInstallment.update({ where: { id: line.sourceId }, data: { invoiceId: null } });
}

async function releaseAll(tx: Tx, invoiceId: string) {
  await tx.timeEntry.updateMany({ where: { invoiceId }, data: { invoiceId: null, status: "APPROVED" } });
  await tx.expense.updateMany({ where: { invoiceId }, data: { invoiceId: null } });
  await tx.feeInstallment.updateMany({ where: { invoiceId }, data: { invoiceId: null } });
}

// ───────────── Invoices ─────────────

export const createInvoice = defineAction({ module: "billing", perm: "create", entity: "Invoice", schema: invoiceSchema }, async (input, { user }) => {
  await checkMatter(user, input.clientId, input.matterId);
  const inv = await prisma.invoice.create({
    data: { ...input, number: draftNumber(), exchangeRate: input.currency === "AED" ? 1 : (input.exchangeRate ?? 1), createdById: user.id },
  });
  return { id: inv.id };
});

export const updateInvoice = defineAction({ module: "billing", perm: "update", entity: "Invoice", schema: invoiceSchema }, async (input, { user }, id: string) => {
  await findDraft(user, id);
  await checkMatter(user, input.clientId, input.matterId);
  await prisma.invoice.update({ where: { id }, data: { ...input, matterId: input.matterId ?? null, exchangeRate: input.currency === "AED" ? 1 : (input.exchangeRate ?? 1) } });
  return { id };
});

export const addInvoiceLine = defineAction({ module: "billing", perm: "update", entity: "InvoiceLine", schema: lineSchema }, async (input, { user }, invoiceId: string) => {
  await findDraft(user, invoiceId);
  const line = await prisma.$transaction(async (tx) => {
    const l = await tx.invoiceLine.create({ data: { ...lineData(input), invoiceId } });
    await recalcInvoice(tx, invoiceId);
    return l;
  });
  return { id: line.id };
});

export const deleteInvoiceLine = defineAction({ module: "billing", perm: "update", entity: "InvoiceLine" }, async (_i, { user }, lineId: string) => {
  const line = await prisma.invoiceLine.findUniqueOrThrow({ where: { id: lineId } });
  await findDraft(user, line.invoiceId);
  await prisma.$transaction(async (tx) => {
    await releaseSource(tx, line);
    await tx.invoiceLine.delete({ where: { id: lineId } });
    await recalcInvoice(tx, line.invoiceId);
  });
  return { id: lineId, audit: line };
});

/** Pulls approved billable time, recharged expenses and unbilled instalments of the case (or client) into the draft. */
export const importUnbilled = defineAction({ module: "billing", perm: "update", entity: "Invoice" }, async (_i, { user }, invoiceId: string) => {
  const inv = await findDraft(user, invoiceId);
  const office = await getOffice();
  const t = await getTranslations("billing");
  const items = await unbilledItems(inv.clientId, inv.matterId);
  const vatRate = office.vatRate;
  let count = 0;
  await prisma.$transaction(async (tx) => {
    for (const e of items.time) {
      const name = e.user.nameAr;
      await tx.invoiceLine.create({
        data: {
          invoiceId,
          ...lineData({ type: "TIME", description: `${isoDate(e.date)} · ${name}: ${e.description}`, quantity: round2(e.minutes / 60).toString(), unitPrice: e.rate.toString(), vatRate }),
          sourceType: "time",
          sourceId: e.id,
        },
      });
      await tx.timeEntry.update({ where: { id: e.id }, data: { invoiceId } });
      count++;
    }
    for (const x of items.expenses) {
      await tx.invoiceLine.create({
        data: { invoiceId, ...lineData({ type: "EXPENSE", description: `${isoDate(x.date)} · ${x.description}`, quantity: 1, unitPrice: x.amount.toString(), vatRate }), sourceType: "expense", sourceId: x.id },
      });
      await tx.expense.update({ where: { id: x.id }, data: { invoiceId } });
      count++;
    }
    for (const i of items.installments) {
      await tx.invoiceLine.create({
        data: {
          invoiceId,
          ...lineData({ type: "FEE", description: i.description || t("installmentLine", { date: isoDate(i.dueDate), fileNo: i.agreement.matter.fileNo }), quantity: 1, unitPrice: i.amount.toString(), vatRate }),
          sourceType: "installment",
          sourceId: i.id,
        },
      });
      await tx.feeInstallment.update({ where: { id: i.id }, data: { invoiceId } });
      count++;
    }
    await recalcInvoice(tx, invoiceId);
  });
  if (!count) throw new ActionError("billing.nothingToImport");
  return { id: invoiceId, data: { count }, audit: { count } };
});

/** Assigns the tax invoice number, posts receivable/revenue/VAT and marks imported time as billed. */
export const issueInvoice = defineAction({ module: "billing", perm: "approve", entity: "Invoice" }, async (_i, { user }, id: string) => {
  const draft = await findDraft(user, id);
  const t = await getTranslations("billing");
  const inv = await prisma.$transaction(async (tx) => {
    const fresh = await recalcInvoice(tx, id);
    if (!dec(fresh.total).greaterThan(0)) throw new ActionError("billing.emptyInvoice");
    const number = await nextNumber("invoice", tx);
    const lines = await tx.invoiceLine.findMany({ where: { invoiceId: id } });
    const reimbursed = sum(lines.filter((l) => l.type === "EXPENSE").map((l) => l.amount));
    const rate = draft.exchangeRate;
    await postEntry(tx, {
      date: draft.issueDate,
      description: t("journal.invoice", { number }),
      sourceType: "invoice",
      sourceId: id,
      createdById: user.id,
      lines: invoiceLines({
        subtotal: toAed(fresh.subtotal, rate),
        vatAmount: toAed(fresh.vatAmount, rate),
        total: toAed(fresh.subtotal, rate).plus(toAed(fresh.vatAmount, rate)),
        reimbursed: toAed(reimbursed, rate),
      }),
    });
    await tx.timeEntry.updateMany({ where: { invoiceId: id }, data: { status: "BILLED" } });
    return tx.invoice.update({ where: { id }, data: { number, status: "ISSUED", issuedAt: new Date() } });
  });
  return { id, audit: { number: inv.number, total: inv.total } };
});

/** Cancels an issued invoice with nothing settled against it: reverses its posting and releases imported items. */
export const cancelInvoice = defineAction({ module: "billing", perm: "approve", entity: "Invoice" }, async (_i, { user }, id: string) => {
  const inv = await findInvoice(user, id);
  if (inv.status === "DRAFT" || inv.status === "CANCELLED") throw new ActionError("billing.notIssued");
  if (dec(inv.paidAmount).greaterThan(0) || dec(inv.creditAmount).greaterThan(0)) throw new ActionError("billing.hasSettlements");
  await prisma.$transaction(async (tx) => {
    await deleteEntriesFor(tx, "invoice", id);
    await releaseAll(tx, id);
    await tx.invoiceLine.updateMany({ where: { invoiceId: id }, data: { sourceType: null, sourceId: null } });
    await tx.invoice.update({ where: { id }, data: { status: "CANCELLED" } });
  });
  return { id };
});

export const deleteInvoice = defineAction({ module: "billing", perm: "delete", entity: "Invoice" }, async (_i, { user }, id: string) => {
  await findDraft(user, id);
  await prisma.$transaction(async (tx) => {
    await releaseAll(tx, id);
    await tx.invoice.update({ where: { id }, data: { deletedAt: new Date() } });
  });
  return { id };
});

// ───────────── Payments ─────────────

export const createPayment = defineAction({ module: "billing", perm: "create", entity: "Payment", schema: paymentSchema }, async (input, { user }) => {
  const t = await getTranslations("billing");
  const payment = await prisma.$transaction(async (tx) => {
    let rate = dec(1);
    if (input.invoiceId) {
      const inv = await findInvoice(user, input.invoiceId, tx);
      if (inv.clientId !== input.clientId) throw new ActionError("billing.invoiceClient");
      if (!["ISSUED", "PARTIALLY_PAID"].includes(inv.status)) throw new ActionError("billing.notPayable");
      if (dec(input.amount).greaterThan(balanceDue(inv))) throw new ActionError("billing.overpayment");
      rate = inv.exchangeRate;
    }
    const bank = await bankAccountFor(input.bankAccountId, tx);
    const number = await nextNumber("payment", tx);
    const p = await tx.payment.create({
      data: { ...input, number, chequeStatus: input.method === "CHEQUE" ? "PENDING" : null, chequeNo: input.method === "CHEQUE" ? input.chequeNo : null },
    });
    const aed = toAed(input.amount, rate);
    await postEntry(tx, {
      date: input.date,
      description: t("journal.payment", { number }),
      sourceType: "payment",
      sourceId: p.id,
      createdById: user.id,
      lines: [
        { accountId: bank.accountId, debit: aed },
        { accountCode: ACC.RECEIVABLE, credit: aed },
      ],
    });
    if (input.invoiceId) await recalcInvoice(tx, input.invoiceId);
    return p;
  });
  return { id: payment.id };
});

const chequeSchema = z.object({ status: z.enum(["CLEARED", "BOUNCED"]) });

/** A bounced cheque no longer counts as paid and its posting is reversed. */
export const setChequeStatus = defineAction({ module: "billing", perm: "update", entity: "Payment", schema: chequeSchema }, async ({ status }, _c, id: string) => {
  const p = await prisma.payment.findUniqueOrThrow({ where: { id } });
  if (p.method !== "CHEQUE" || p.chequeStatus !== "PENDING") throw new ActionError("billing.chequeNotPending");
  await prisma.$transaction(async (tx) => {
    await tx.payment.update({ where: { id }, data: { chequeStatus: status } });
    if (status === "BOUNCED") await deleteEntriesFor(tx, "payment", id);
    if (p.invoiceId) await recalcInvoice(tx, p.invoiceId);
  });
  return { id, audit: { status } };
});

export const deletePayment = defineAction({ module: "billing", perm: "delete", entity: "Payment" }, async (_i, _c, id: string) => {
  const p = await prisma.payment.findUniqueOrThrow({ where: { id } });
  await prisma.$transaction(async (tx) => {
    await tx.payment.update({ where: { id }, data: { deletedAt: new Date() } });
    await deleteEntriesFor(tx, "payment", id);
    if (p.invoiceId) await recalcInvoice(tx, p.invoiceId);
  });
  return { id };
});

// ───────────── Credit notes ─────────────

export const createCreditNote = defineAction({ module: "billing", perm: "approve", entity: "CreditNote", schema: creditNoteSchema }, async (input, { user }, invoiceId: string) => {
  const t = await getTranslations("billing");
  const cn = await prisma.$transaction(async (tx) => {
    const inv = await findInvoice(user, invoiceId, tx);
    if (!["ISSUED", "PARTIALLY_PAID"].includes(inv.status)) throw new ActionError("billing.notPayable");
    const totals = creditNoteTotals(input.amount, input.vatRate);
    if (!totals.total.greaterThan(0)) throw new ActionError("v.min0");
    if (totals.total.greaterThan(balanceDue(inv))) throw new ActionError("billing.creditTooLarge");
    const number = await nextNumber("creditNote", tx);
    const c = await tx.creditNote.create({ data: { number, invoiceId, date: input.date, reason: input.reason, ...totals } });
    const rate = inv.exchangeRate;
    const net = toAed(totals.subtotal, rate);
    const vat = toAed(totals.vatAmount, rate);
    await postEntry(tx, {
      date: input.date,
      description: t("journal.creditNote", { number, invoice: inv.number }),
      sourceType: "creditNote",
      sourceId: c.id,
      createdById: user.id,
      lines: [
        { accountCode: ACC.FEES_REVENUE, debit: net },
        { accountCode: ACC.VAT_OUTPUT, debit: vat },
        { accountCode: ACC.RECEIVABLE, credit: net.plus(vat) },
      ],
    });
    await recalcInvoice(tx, invoiceId);
    return c;
  });
  return { id: cn.id };
});

// ───────────── Trust (client funds) ─────────────

export const createTrustTransaction = defineAction({ module: "billing", perm: "create", entity: "TrustTransaction", schema: trustSchema }, async (input, { user }) => {
  await checkMatter(user, input.clientId, input.matterId);
  const t = await getTranslations("billing");
  const tr = await prisma.$transaction(async (tx) => {
    const bank = await bankAccountFor(input.bankAccountId, tx);
    if (input.type !== "DEPOSIT" && dec(input.amount).greaterThan(await clientTrustBalance(input.clientId, tx))) throw new ActionError("billing.trustInsufficient");
    const row = await tx.trustTransaction.create({ data: input });
    const amount = round2(input.amount);
    await postEntry(tx, {
      date: input.date,
      description: t(`journal.trust.${input.type}`),
      sourceType: "trust",
      sourceId: row.id,
      createdById: user.id,
      lines:
        input.type === "DEPOSIT"
          ? [
              { accountId: bank.accountId, debit: amount },
              { accountCode: ACC.TRUST_LIABILITY, credit: amount },
            ]
          : [
              { accountCode: ACC.TRUST_LIABILITY, debit: amount },
              { accountId: bank.accountId, credit: amount },
            ],
    });
    return row;
  });
  return { id: tr.id };
});

/** Pays (part of) an invoice from the client's trust balance. */
export const applyTrust = defineAction({ module: "billing", perm: "approve", entity: "TrustTransaction", schema: applyTrustSchema }, async ({ amount }, { user }, invoiceId: string) => {
  const t = await getTranslations("billing");
  const tr = await prisma.$transaction(async (tx) => {
    const inv = await findInvoice(user, invoiceId, tx);
    if (!["ISSUED", "PARTIALLY_PAID"].includes(inv.status)) throw new ActionError("billing.notPayable");
    if (inv.currency !== "AED") throw new ActionError("billing.trustAedOnly");
    const value = round2(amount);
    if (!value.greaterThan(0)) throw new ActionError("v.min0");
    if (value.greaterThan(balanceDue(inv))) throw new ActionError("billing.overpayment");
    if (value.greaterThan(await clientTrustBalance(inv.clientId, tx))) throw new ActionError("billing.trustInsufficient");
    const row = await tx.trustTransaction.create({
      data: { clientId: inv.clientId, matterId: inv.matterId, date: new Date(), type: "APPLIED", amount: value, invoiceId, notes: inv.number },
    });
    await postEntry(tx, {
      date: row.date,
      description: t("journal.trustApplied", { number: inv.number }),
      sourceType: "trust",
      sourceId: row.id,
      createdById: user.id,
      lines: [
        { accountCode: ACC.TRUST_LIABILITY, debit: value },
        { accountCode: ACC.RECEIVABLE, credit: value },
      ],
    });
    await recalcInvoice(tx, invoiceId);
    return row;
  });
  return { id: tr.id };
});

// ───────────── Quotes ─────────────

async function findQuote(user: CurrentUser, id: string) {
  const q = await prisma.quote.findFirst({ where: { AND: [quoteScope(user), { id }] } });
  if (!q) throw new ActionError("errors.notFound");
  return q;
}

export const createQuote = defineAction({ module: "billing", perm: "create", entity: "Quote", schema: quoteSchema }, async (input, { user }) => {
  await checkMatter(user, input.clientId, input.matterId);
  const q = await prisma.quote.create({ data: { ...input, number: await nextNumber("quote") } });
  return { id: q.id };
});

export const updateQuote = defineAction({ module: "billing", perm: "update", entity: "Quote", schema: quoteSchema }, async (input, { user }, id: string) => {
  const q = await findQuote(user, id);
  if (q.status === "CONVERTED") throw new ActionError("billing.quoteLocked");
  await checkMatter(user, input.clientId, input.matterId);
  await prisma.quote.update({ where: { id }, data: { ...input, matterId: input.matterId ?? null } });
  return { id };
});

export const addQuoteLine = defineAction({ module: "billing", perm: "update", entity: "QuoteLine", schema: lineSchema }, async (input, { user }, quoteId: string) => {
  const q = await findQuote(user, quoteId);
  if (q.status === "CONVERTED") throw new ActionError("billing.quoteLocked");
  const l = await prisma.$transaction(async (tx) => {
    const line = await tx.quoteLine.create({ data: { ...lineData(input), quoteId } });
    await recalcQuote(tx, quoteId);
    return line;
  });
  return { id: l.id };
});

export const deleteQuoteLine = defineAction({ module: "billing", perm: "update", entity: "QuoteLine" }, async (_i, { user }, lineId: string) => {
  const line = await prisma.quoteLine.findUniqueOrThrow({ where: { id: lineId } });
  const q = await findQuote(user, line.quoteId);
  if (q.status === "CONVERTED") throw new ActionError("billing.quoteLocked");
  await prisma.$transaction(async (tx) => {
    await tx.quoteLine.delete({ where: { id: lineId } });
    await recalcQuote(tx, line.quoteId);
  });
  return { id: lineId };
});

const quoteStatusSchema = z.object({ status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED"]) });

export const setQuoteStatus = defineAction({ module: "billing", perm: "update", entity: "Quote", schema: quoteStatusSchema }, async ({ status }, { user }, id: string) => {
  const q = await findQuote(user, id);
  if (q.status === "CONVERTED") throw new ActionError("billing.quoteLocked");
  await prisma.quote.update({ where: { id }, data: { status } });
  return { id, audit: { status } };
});

/** Creates a draft invoice with the quote's lines. */
export const convertQuote = defineAction({ module: "billing", perm: "create", entity: "Quote" }, async (_i, { user }, id: string) => {
  const q = await findQuote(user, id);
  if (q.status === "CONVERTED") throw new ActionError("billing.quoteLocked");
  const lines = await prisma.quoteLine.findMany({ where: { quoteId: id } });
  if (!lines.length) throw new ActionError("billing.emptyInvoice");
  const inv = await prisma.$transaction(async (tx) => {
    const created = await tx.invoice.create({
      data: {
        number: draftNumber(),
        clientId: q.clientId,
        matterId: q.matterId,
        currency: q.currency,
        notes: q.notes,
        createdById: user.id,
        lines: { create: lines.map(({ type, description, quantity, unitPrice, vatRate, amount, vatAmount }) => ({ type, description, quantity, unitPrice, vatRate, amount, vatAmount })) },
      },
    });
    await recalcInvoice(tx, created.id);
    await tx.quote.update({ where: { id }, data: { status: "CONVERTED", invoiceId: created.id } });
    return created;
  });
  return { id: inv.id };
});

export const deleteQuote = defineAction({ module: "billing", perm: "delete", entity: "Quote" }, async (_i, { user }, id: string) => {
  const q = await findQuote(user, id);
  if (q.status === "CONVERTED") throw new ActionError("billing.quoteLocked");
  await prisma.quote.update({ where: { id }, data: { deletedAt: new Date() } });
  return { id };
});
