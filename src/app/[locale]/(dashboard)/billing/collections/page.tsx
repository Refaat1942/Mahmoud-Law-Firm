import { getLocale, getTranslations } from "next-intl/server";
import { Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/session";
import { localized } from "@/lib/utils";
import { dec, round2 } from "@/lib/money";
import { agingBucket } from "@/lib/aging";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { ActionButton } from "@/components/action-button";
import { DataTable } from "@/components/data-table";
import { EntityForm } from "@/components/entity-form";
import { DateText, Money } from "@/components/format";
import { PageHeader, Section } from "@/components/page";
import { enumOptions, userOptions } from "@/server/options";
import { createCollectionNote, deleteCollectionNote } from "@/server/collections/actions";
import { collectionScope, openInvoiceWhere } from "@/server/collections/queries";
import { BillingNav } from "../nav";

const balanceOf = (i: { total: { toString(): string }; paidAmount: { toString(): string }; creditAmount: { toString(): string } }) =>
  round2(dec(i.total.toString()).minus(i.paidAmount.toString()).minus(i.creditAmount.toString()));

export default async function CollectionsPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const user = await requirePermission("billing");
  const t = await getTranslations();
  const locale = await getLocale();
  const { client: clientId } = await searchParams;
  const now = new Date();

  const [invoices, notes] = await Promise.all([
    prisma.invoice.findMany({ where: openInvoiceWhere(user), include: { client: true }, orderBy: { issueDate: "asc" } }),
    prisma.collectionNote.findMany({ where: collectionScope(user), orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 5000 }),
  ]);

  type Row = { clientId: string; name: string; balance: ReturnType<typeof dec>; count: number; oldestDue: Date; overdueDays: number };
  const byClient = new Map<string, Row>();
  for (const i of invoices) {
    const bal = balanceOf(i);
    if (!bal.greaterThan(0)) continue;
    const due = i.dueDate ?? i.issueDate;
    const r = byClient.get(i.clientId) ?? { clientId: i.clientId, name: localized(i.client, locale), balance: dec(0), count: 0, oldestDue: due, overdueDays: 0 };
    r.balance = round2(r.balance.plus(bal));
    r.count++;
    if (due < r.oldestDue) r.oldestDue = due;
    r.overdueDays = Math.max(0, Math.floor((+now - +r.oldestDue) / 86_400_000));
    byClient.set(i.clientId, r);
  }
  const lastNote = new Map<string, (typeof notes)[number]>();
  const nextFollow = new Map<string, Date>();
  for (const n of notes) {
    if (!lastNote.has(n.clientId)) lastNote.set(n.clientId, n);
    if (n.nextFollowUp && n.nextFollowUp >= new Date(now.toDateString()) && (!nextFollow.has(n.clientId) || n.nextFollowUp < nextFollow.get(n.clientId)!))
      nextFollow.set(n.clientId, n.nextFollowUp);
  }

  const selected = clientId ? await prisma.client.findFirst({ where: { id: clientId, deletedAt: null } }) : null;
  const clientInvoices = selected ? invoices.filter((i) => i.clientId === selected.id && balanceOf(i).greaterThan(0)) : [];
  const clientNotes = selected ? notes.filter((n) => n.clientId === selected.id) : [];
  const users = await userOptions();
  const userName = new Map(users.map((u) => [u.value, u.label]));
  const canUpdate = can(user, "billing", "update");
  const canDelete = can(user, "billing", "delete");

  return (
    <>
      <PageHeader title={t("nav.billing")} />
      <BillingNav active="collections" />
      {selected ? (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              <Link href={`/clients/${selected.id}`} className="hover:underline">
                {localized(selected, locale)}
              </Link>
            </h2>
            <Link href="/billing/collections" className="text-sm text-primary hover:underline dark:text-accent">
              {t("collections.allClients")}
            </Link>
          </div>
          <Section title={t("collections.openInvoices")}>
            {clientInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("collections.nothingOwed")}</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>{t("f.number")}</Th>
                    <Th>{t("f.dueDate")}</Th>
                    <Th>{t("collections.aging")}</Th>
                    <Th>{t("f.balance")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {clientInvoices.map((i) => (
                    <tr key={i.id}>
                      <Td>
                        <Link href={`/billing/invoices/${i.id}`} className="text-primary hover:underline dark:text-accent">
                          {i.number}
                        </Link>
                      </Td>
                      <Td>
                        <DateText value={i.dueDate ?? i.issueDate} />
                      </Td>
                      <Td>{t(`collections.buckets.${agingBucket(i.dueDate ?? i.issueDate, now)}`)}</Td>
                      <Td>
                        <Money value={balanceOf(i).toString()} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Section>
          {canUpdate && (
            <Section title={t("collections.logContact")}>
              <EntityForm
                schema="collectionNote"
                action={createCollectionNote.bind(null, selected.id)}
                resetOnSuccess
                defaultValues={{ date: now.toISOString().slice(0, 10), action: "CALL", assigneeId: user.id }}
                fields={[
                  { name: "date", label: t("f.date"), type: "date", required: true },
                  { name: "action", label: t("collections.action"), type: "select", options: await enumOptions("CollectionAction"), required: true },
                  { name: "invoiceId", label: t("f.invoice"), type: "select", options: clientInvoices.map((i) => ({ value: i.id, label: i.number })) },
                  { name: "assigneeId", label: t("f.assignee"), type: "select", options: users },
                  { name: "outcome", label: t("collections.outcome"), type: "textarea", required: true, span: 2 },
                  { name: "promisedAmount", label: t("collections.promisedAmount"), type: "money" },
                  { name: "promisedDate", label: t("collections.promisedDate"), type: "date" },
                  { name: "nextFollowUp", label: t("collections.nextFollowUp"), type: "date", help: t("collections.nextFollowUpHelp") },
                ]}
              />
            </Section>
          )}
          <Section title={t("collections.history")}>
            {clientNotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("collections.noNotes")}</p>
            ) : (
              <ul className="divide-y">
                {clientNotes.map((n) => (
                  <li key={n.id} className="flex items-start gap-3 py-3 text-sm">
                    <div className="w-24 shrink-0 text-muted-foreground">
                      <DateText value={n.date} />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="info">{t(`enum.CollectionAction.${n.action}`)}</Badge>
                        {n.createdById && <span className="text-xs text-muted-foreground">{userName.get(n.createdById)}</span>}
                      </div>
                      <p className="whitespace-pre-wrap">{n.outcome}</p>
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        {n.promisedAmount && (
                          <span>
                            {t("collections.promise")}: <Money value={n.promisedAmount.toString()} /> {n.promisedDate && <DateText value={n.promisedDate} />}
                          </span>
                        )}
                        {n.nextFollowUp && (
                          <span>
                            {t("collections.nextFollowUp")}: <DateText value={n.nextFollowUp} />
                          </span>
                        )}
                      </div>
                    </div>
                    {canDelete && (
                      <ActionButton size="icon" variant="ghost" action={deleteCollectionNote.bind(null, n.id)} confirm={t("common.confirmDelete")} aria-label={t("common.delete")}>
                        <Trash2 />
                      </ActionButton>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      ) : (
        <DataTable
          exportName="collections"
          emptyText={t("collections.empty")}
          columns={[
            { key: "name", label: t("f.client"), href: "/billing/collections?client=:id" },
            { key: "count", label: t("collections.invoices"), type: "number" },
            { key: "balance", label: t("f.balance"), type: "money" },
            { key: "oldestDue", label: t("collections.oldestDue"), type: "date" },
            { key: "overdueDays", label: t("collections.overdueDays"), type: "number" },
            { key: "lastContact", label: t("collections.lastContact"), type: "date" },
            { key: "lastOutcome", label: t("collections.outcome") },
            { key: "nextFollowUp", label: t("collections.nextFollowUp"), type: "date" },
          ]}
          rows={[...byClient.values()]
            .sort((a, b) => b.overdueDays - a.overdueDays || +b.balance.minus(a.balance))
            .map((r) => {
              const last = lastNote.get(r.clientId);
              return {
                id: r.clientId,
                name: r.name,
                count: String(r.count),
                balance: r.balance.toString(),
                oldestDue: r.oldestDue.toISOString(),
                overdueDays: String(r.overdueDays),
                lastContact: last?.date.toISOString() ?? "",
                lastOutcome: last ? `${t(`enum.CollectionAction.${last.action}`)}: ${last.outcome.slice(0, 80)}` : "",
                nextFollowUp: nextFollow.get(r.clientId)?.toISOString() ?? "",
              };
            })}
        />
      )}
    </>
  );
}
