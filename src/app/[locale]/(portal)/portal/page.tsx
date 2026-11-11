import { getLocale, getTranslations } from "next-intl/server";
import { Download, MessageSquare } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { balanceDue } from "@/lib/billing";
import { localized, localizedTitle, startOfDay } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { Badge, STATUS_TONES } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { DataTable } from "@/components/data-table";
import { EntityForm } from "@/components/entity-form";
import { DateText, Money } from "@/components/format";
import { PageHeader, Section, StatCard } from "@/components/page";
import { clientStatement } from "@/server/clients/queries";
import { respondApproval, uploadClientDocument } from "@/server/portal/actions";

export default async function PortalHome() {
  const user = await requireUser();
  const clientId = user.clientId!;
  const t = await getTranslations();
  const locale = await getLocale();
  const [matters, hearings, invoices, docs, approvals, statement] = await Promise.all([
    prisma.matter.findMany({ where: { clientId, deletedAt: null }, include: { court: true }, orderBy: [{ status: "asc" }, { openedAt: "desc" }] }),
    prisma.hearing.findMany({ where: { deletedAt: null, date: { gte: startOfDay() }, matter: { clientId, deletedAt: null } }, include: { matter: true, court: true }, orderBy: { date: "asc" }, take: 10 }),
    prisma.invoice.findMany({ where: { clientId, deletedAt: null, status: { notIn: ["DRAFT", "CANCELLED"] } }, orderBy: { issueDate: "desc" }, take: 20 }),
    prisma.document.findMany({ where: { clientId, deletedAt: null, visibleToClient: true }, include: { versions: { orderBy: { version: "desc" }, take: 1 }, matter: true }, orderBy: { updatedAt: "desc" }, take: 20 }),
    prisma.clientApproval.findMany({ where: { clientId }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 20 }),
    clientStatement(clientId),
  ]);
  const pending = approvals.filter((a) => a.status === "PENDING");
  const answered = approvals.filter((a) => a.status !== "PENDING");
  return (
    <>
      <PageHeader
        title={t("portal.welcome", { name: locale === "en" ? user.nameEn || user.nameAr : user.nameAr })}
        actions={
          <Link href="/portal/messages" className={buttonVariants()}>
            <MessageSquare /> {t("portal.messages")}
          </Link>
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        {pending.length > 0 && (
          <Section title={t("approvals.awaiting")} className="border-warning/50 lg:col-span-2">
            <div className="space-y-5">
              {pending.map((a) => (
                <div key={a.id} className="space-y-2 rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{a.title}</span>
                    <span className="text-xs text-muted-foreground">
                      <DateText value={a.createdAt} />
                    </span>
                  </div>
                  {a.details && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{a.details}</p>}
                  <EntityForm
                    schema="approvalResponse"
                    action={respondApproval.bind(null, a.id)}
                    compact
                    defaultValues={{ status: "APPROVED" }}
                    fields={[
                      {
                        name: "status",
                        label: t("approvals.decision"),
                        type: "select",
                        required: true,
                        options: [
                          { value: "APPROVED", label: t("enum.ApprovalState.APPROVED") },
                          { value: "DECLINED", label: t("enum.ApprovalState.DECLINED") },
                        ],
                      },
                      { name: "response", label: t("approvals.comment"), type: "textarea" },
                    ]}
                  />
                </div>
              ))}
            </div>
          </Section>
        )}
        <Section title={t("portal.myCases")} className="lg:col-span-2">
          {matters.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>{t("f.fileNo")}</Th>
                  <Th>{t("f.title")}</Th>
                  <Th>{t("f.court")}</Th>
                  <Th>{t("f.courtCaseNo")}</Th>
                  <Th>{t("f.status")}</Th>
                </tr>
              </thead>
              <tbody>
                {matters.map((m) => (
                  <tr key={m.id}>
                    <Td>
                      <Link href={`/portal/cases/${m.id}`} className="text-primary hover:underline dark:text-accent">
                        {m.fileNo}
                      </Link>
                    </Td>
                    <Td>{localizedTitle(m, locale)}</Td>
                    <Td>{localized(m.court, locale)}</Td>
                    <Td dir="ltr">{m.courtCaseNo}</Td>
                    <Td>
                      <Badge tone={STATUS_TONES[m.status]}>{t(`enum.MatterStatus.${m.status}`)}</Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Section>
        <Section title={t("dashboard.upcomingHearings")}>
          {hearings.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("dashboard.noHearings")}</p>
          ) : (
            <ul className="divide-y text-sm">
              {hearings.map((h) => (
                <li key={h.id} className="flex justify-between gap-3 py-2">
                  <span>
                    {h.matter.fileNo} — {localized(h.court, locale)}
                  </span>
                  <DateText value={h.date} withTime />
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title={t("billing.invoices")}>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
          ) : (
            <ul className="divide-y text-sm">
              {invoices.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    {i.number} · <DateText value={i.issueDate} /> <Badge tone={STATUS_TONES[i.status]}>{t(`enum.InvoiceStatus.${i.status}`)}</Badge>
                  </span>
                  <span className="flex items-center gap-1">
                    <Money value={balanceDue(i).toString()} currency={i.currency} />
                    <a href={`/api/pdf/invoice/${i.id}?locale=${locale}`} target="_blank" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label={t("common.download")}>
                      <Download />
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title={t("portal.uploadTitle")}>
          <p className="mb-3 text-xs text-muted-foreground">{t("portal.uploadHelp")}</p>
          <EntityForm
            schema="portalUpload"
            action={uploadClientDocument}
            resetOnSuccess
            columns={1}
            fields={[
              { name: "file", label: t("f.file"), type: "file", required: true },
              { name: "name", label: t("f.name") },
              { name: "matterId", label: t("f.matter"), type: "select", options: matters.map((m) => ({ value: m.id, label: `${m.fileNo} — ${localizedTitle(m, locale)}` })) },
            ]}
          />
        </Section>
        <Section title={t("approvals.title")}>
          {answered.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("approvals.none")}</p>
          ) : (
            <ul className="divide-y text-sm">
              {answered.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                  <span>{a.title}</span>
                  <Badge tone={STATUS_TONES[a.status] ?? "neutral"}>{t(`enum.ApprovalState.${a.status}`)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title={t("clients.statement")} className="lg:col-span-2">
          <div className="mb-4 grid gap-4 md:grid-cols-2">
            <StatCard label={t("clients.balanceDue")} value={<Money value={statement.balance} />} />
            <StatCard label={t("billing.trustBalance")} value={<Money value={statement.trustBalance} />} />
          </div>
          <DataTable
            exportName="statement"
            pageSize={50}
            columns={[
              { key: "date", label: t("f.date"), type: "date" },
              { key: "ref", label: t("f.reference") },
              { key: "kind", label: t("f.type"), type: "badge", enumKey: "StatementKind" },
              { key: "debit", label: t("f.debit"), type: "money" },
              { key: "credit", label: t("f.credit"), type: "money" },
              { key: "balance", label: t("f.balance"), type: "money" },
            ]}
            rows={statement.rows}
          />
        </Section>
        <Section title={t("portal.sharedDocuments")} className="lg:col-span-2">
          {docs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("portal.noDocuments")}</p>
          ) : (
            <ul className="divide-y text-sm">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    {d.name} <span className="text-xs text-muted-foreground">· {t(`enum.DocumentCategory.${d.category}`)}{d.matter ? ` · ${d.matter.fileNo}` : ""}</span>
                  </span>
                  {d.versions[0] && (
                    <a href={`/api/documents/${d.versions[0].id}`} className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label={t("common.download")}>
                      <Download />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
