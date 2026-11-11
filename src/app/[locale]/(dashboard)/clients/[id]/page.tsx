import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Download, Eye, MessageCircle, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, matterScope, requirePermission } from "@/lib/session";
import { localized, localizedTitle } from "@/lib/utils";
import { daysUntil } from "@/lib/deadlines";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { DataTable } from "@/components/data-table";
import { EntityForm } from "@/components/entity-form";
import { ActionButton } from "@/components/action-button";
import { DateText, Money } from "@/components/format";
import { DetailList, PageHeader, Section, StatCard, Tabs } from "@/components/page";
import { addContact, addPoa, deleteClient, deleteContact, deletePoa } from "@/server/clients/actions";
import { clientStatement } from "@/server/clients/queries";
import { invoiceScope } from "@/server/billing/queries";
import { documentScope } from "@/server/documents/queries";
import { replyToClient } from "@/server/portal/actions";
import { MessageThread } from "@/components/message-thread";

/** A tap-to-call number; mobiles also get a WhatsApp link. */
function PhoneLink({ value, whatsapp }: { value: string; whatsapp?: boolean }) {
  const digits = value.replace(/[^\d+]/g, "");
  const wa = digits.replace(/^\+/, "").replace(/^00/, "").replace(/^0(?=5)/, "971");
  return (
    <span className="inline-flex items-center gap-2" dir="ltr">
      <a href={`tel:${digits}`} className="inline-flex items-center gap-1 text-primary hover:underline dark:text-accent">
        <Phone className="size-3.5" />
        {value}
      </a>
      {whatsapp && (
        <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener" className="text-success hover:opacity-80" aria-label="WhatsApp">
          <MessageCircle className="size-4" />
        </a>
      )}
    </span>
  );
}

export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requirePermission("clients");
  const { id } = await params;
  const tab = (await searchParams).tab ?? "overview";
  const t = await getTranslations();
  const locale = await getLocale();
  const client = await prisma.client.findFirst({
    where: { id, deletedAt: null },
    include: { contacts: { orderBy: { createdAt: "asc" } }, powers: {
        where: { deletedAt: null },
        include: { document: { include: { versions: { orderBy: { version: "desc" }, take: 1 } } } },
        orderBy: { expiresAt: "asc" },
      },
    },
  });
  if (!client) notFound();
  const canEdit = can(user, "clients", "update");
  const statement = can(user, "billing") ? await clientStatement(id) : null;
  const unreadMessages = await prisma.message.count({ where: { clientId: id, fromClient: true, readAt: null } });

  const tabs = [
    { key: "overview", label: t("common.overview") },
    { key: "matters", label: t("nav.cases") },
    ...(can(user, "billing") ? [{ key: "invoices", label: t("billing.invoices") }, { key: "statement", label: t("clients.statement") }] : []),
    ...(can(user, "documents") ? [{ key: "documents", label: t("nav.documents") }] : []),
    { key: "messages", label: unreadMessages ? `${t("portal.messages")} (${unreadMessages})` : t("portal.messages") },
  ];

  let content: React.ReactNode = null;
  if (tab === "matters") {
    const matters = await prisma.matter.findMany({ where: { AND: [matterScope(user), { clientId: id }] }, include: { court: true, type: true }, orderBy: { openedAt: "desc" } });
    content = (
      <DataTable
        exportName={`${client.code}-matters`}
        columns={[
          { key: "fileNo", label: t("f.fileNo"), href: "/cases/:id" },
          { key: "title", label: t("f.title"), href: "/cases/:id" },
          { key: "type", label: t("f.matterType") },
          { key: "court", label: t("f.court") },
          { key: "status", label: t("f.status"), type: "badge", enumKey: "MatterStatus" },
          { key: "openedAt", label: t("f.openedAt"), type: "date" },
        ]}
        rows={matters.map((m) => ({
          id: m.id,
          fileNo: m.fileNo,
          title: localizedTitle(m, locale),
          type: localized(m.type, locale),
          court: localized(m.court, locale),
          status: m.status,
          openedAt: m.openedAt.toISOString(),
        }))}
      />
    );
  } else if (tab === "invoices") {
    const invoices = await prisma.invoice.findMany({ where: { AND: [invoiceScope(user), { clientId: id }] }, orderBy: { issueDate: "desc" } });
    content = (
      <DataTable
        exportName={`${client.code}-invoices`}
        columns={[
          { key: "number", label: t("f.number"), href: "/billing/invoices/:id" },
          { key: "issueDate", label: t("f.issueDate"), type: "date" },
          { key: "dueDate", label: t("f.dueDate"), type: "date" },
          { key: "total", label: t("f.total"), type: "money", currencyKey: "currency" },
          { key: "paidAmount", label: t("f.paidAmount"), type: "money", currencyKey: "currency" },
          { key: "status", label: t("f.status"), type: "badge", enumKey: "InvoiceStatus" },
        ]}
        rows={invoices.map((i) => ({
          id: i.id,
          number: i.number,
          issueDate: i.issueDate.toISOString(),
          dueDate: i.dueDate?.toISOString() ?? "",
          total: i.total.toString(),
          paidAmount: i.paidAmount.toString(),
          currency: i.currency,
          status: i.status,
        }))}
      />
    );
  } else if (tab === "statement" && statement) {
    content = (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <StatCard label={t("clients.balanceDue")} value={<Money value={statement.balance} />} />
          <StatCard label={t("billing.trustBalance")} value={<Money value={statement.trustBalance} />} />
        </div>
        <DataTable
          exportName={`${client.code}-statement`}
          pageSize={100}
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
      </div>
    );
  } else if (tab === "messages") {
    const matters = await prisma.matter.findMany({ where: { AND: [matterScope(user), { clientId: id }] }, orderBy: { openedAt: "desc" } });
    const portalUsers = await prisma.user.count({ where: { clientId: id, deletedAt: null, isActive: true } });
    // Opening the thread marks the client's messages as read.
    await prisma.message.updateMany({ where: { clientId: id, fromClient: true, readAt: null }, data: { readAt: new Date() } });
    content = (
      <div className="grid gap-5 lg:grid-cols-3">
        <Section className="lg:col-span-2">
          <MessageThread clientId={id} side="office" />
        </Section>
        <Section title={t("portal.reply")}>
          {portalUsers === 0 && <p className="mb-3 text-xs text-muted-foreground">{t("portal.noPortalUsers")}</p>}
          {canEdit && (
            <EntityForm
              schema="message"
              action={replyToClient.bind(null, id)}
              columns={1}
              resetOnSuccess
              submitLabel={t("portal.send")}
              fields={[
                { name: "matterId", label: t("f.matter"), type: "select", options: matters.map((m) => ({ value: m.id, label: `${m.fileNo} — ${localizedTitle(m, locale)}` })), placeholder: t("portal.general") },
                { name: "body", label: t("f.message"), type: "textarea", required: true },
              ]}
            />
          )}
        </Section>
      </div>
    );
  } else if (tab === "documents") {
    const docs = await prisma.document.findMany({ where: { AND: [documentScope(user), { clientId: id }] }, orderBy: { createdAt: "desc" } });
    content = (
      <DataTable
        exportName={`${client.code}-documents`}
        columns={[
          { key: "name", label: t("f.name"), href: "/documents/:id" },
          { key: "category", label: t("f.category"), type: "badge", enumKey: "DocumentCategory" },
          { key: "folder", label: t("f.folder") },
          { key: "createdAt", label: t("f.createdAt"), type: "date" },
        ]}
        rows={docs.map((d) => ({ id: d.id, name: d.name, category: d.category, folder: d.folder, createdAt: d.createdAt.toISOString() }))}
      />
    );
  } else {
    content = (
      <div className="space-y-5">
        <Section title={t("common.details")}>
          <DetailList
            items={[
              { label: t("f.code"), value: client.code },
              { label: t("f.clientType"), value: t(`enum.PartyType.${client.type}`) },
              { label: t("f.nameAr"), value: client.nameAr },
              { label: t("f.nameEn"), value: client.nameEn },
              ...(client.type === "COMPANY"
                ? [{ label: t("f.tradeLicenseNo"), value: client.tradeLicenseNo }]
                : [
                    { label: t("f.emiratesId"), value: client.emiratesId },
                    { label: t("f.passportNo"), value: client.passportNo },
                    { label: t("f.nationality"), value: client.nationality },
                  ]),
              { label: t("f.trn"), value: client.trn },
              { label: t("f.email"), value: client.email },
              { label: t("f.mobile"), value: client.mobile && <PhoneLink value={client.mobile} whatsapp /> },
              { label: t("f.phone"), value: client.phone && <PhoneLink value={client.phone} /> },
              { label: t("f.altPhone"), value: client.altPhone && <PhoneLink value={client.altPhone} /> },
              { label: t("f.address"), value: client.address },
              { label: t("f.notes"), value: client.notes },
            ]}
          />
        </Section>

        <div className="grid gap-5 lg:grid-cols-2">
          <Section title={t("clients.powers")}>
            {client.powers.length > 0 && (
              <Table className="mb-4">
                <thead>
                  <tr>
                    <Th>{t("f.poaNumber")}</Th>
                    <Th>{t("f.issuedAt")}</Th>
                    <Th>{t("f.expiresAt")}</Th>
                    <Th>{t("f.notary")}</Th>
                    <Th>{t("f.file")}</Th>
                    {canEdit && <Th />}
                  </tr>
                </thead>
                <tbody>
                  {client.powers.map((p) => {
                    const left = p.expiresAt ? daysUntil(p.expiresAt) : null;
                    return (
                      <tr key={p.id}>
                        <Td>{p.number}</Td>
                        <Td>
                          <DateText value={p.issuedAt} />
                        </Td>
                        <Td>
                          <DateText value={p.expiresAt} />{" "}
                          {left !== null && left < 0 && <Badge tone="danger">{t("enum.ExpiryState.EXPIRED")}</Badge>}
                          {left !== null && left >= 0 && left <= 30 && <Badge tone="warning">{t("clients.daysLeft", { days: left })}</Badge>}
                        </Td>
                        <Td>{p.notary}</Td>
                        <Td className="whitespace-nowrap">
                          {p.document?.versions[0] ? (
                            <>
                              <a
                                href={`/api/documents/${p.document.versions[0].id}?inline=1`}
                                target="_blank"
                                rel="noopener"
                                className={buttonVariants({ variant: "ghost", size: "icon" })}
                                aria-label={t("documents.preview")}
                                title={t("documents.preview")}
                              >
                                <Eye />
                              </a>
                              <a
                                href={`/api/documents/${p.document.versions[0].id}`}
                                className={buttonVariants({ variant: "ghost", size: "icon" })}
                                aria-label={t("common.download")}
                                title={t("common.download")}
                              >
                                <Download />
                              </a>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">{t("clients.noPoaFile")}</span>
                          )}
                        </Td>
                        {canEdit && (
                          <Td>
                            <ActionButton variant="ghost" size="icon" action={deletePoa.bind(null, p.id)} confirm={t("common.confirmDelete")} aria-label={t("common.delete")}>
                              <Trash2 />
                            </ActionButton>
                          </Td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
            {canEdit && (
              <EntityForm
                compact
                schema="poa"
                action={addPoa.bind(null, id)}
                resetOnSuccess
                submitLabel={t("common.add")}
                fields={[
                  { name: "number", label: t("f.poaNumber"), required: true },
                  { name: "notary", label: t("f.notary") },
                  { name: "issuedAt", label: t("f.issuedAt"), type: "date" },
                  { name: "expiresAt", label: t("f.expiresAt"), type: "date" },
                  { name: "file", label: t("clients.poaFile"), type: "file", span: 2, help: t("clients.poaFileHelp") },
                  { name: "scope", label: t("f.scope"), type: "textarea" },
                ]}
              />
            )}
          </Section>
          <Section title={t("clients.contacts")}>
            {client.contacts.length > 0 && (
              <Table className="mb-4">
                <thead>
                  <tr>
                    <Th>{t("f.name")}</Th>
                    <Th>{t("f.position")}</Th>
                    <Th>{t("f.phone")}</Th>
                    <Th>{t("f.email")}</Th>
                    {canEdit && <Th />}
                  </tr>
                </thead>
                <tbody>
                  {client.contacts.map((c) => (
                    <tr key={c.id}>
                      <Td>{c.name}</Td>
                      <Td>{c.position}</Td>
                      <Td dir="ltr">{c.phone}</Td>
                      <Td>{c.email}</Td>
                      {canEdit && (
                        <Td>
                          <ActionButton variant="ghost" size="icon" action={deleteContact.bind(null, c.id)} confirm={t("common.confirmDelete")} aria-label={t("common.delete")}>
                            <Trash2 />
                          </ActionButton>
                        </Td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            {canEdit && (
              <EntityForm
                compact
                schema="contact"
                action={addContact.bind(null, id)}
                resetOnSuccess
                submitLabel={t("common.add")}
                fields={[
                  { name: "name", label: t("f.name"), required: true },
                  { name: "position", label: t("f.position") },
                  { name: "phone", label: t("f.phone"), type: "tel" },
                  { name: "email", label: t("f.email"), type: "email" },
                ]}
              />
            )}
          </Section>

        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={localized(client, locale)}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              {client.code} · {t(`enum.PartyType.${client.type}`)}
            </span>
            {client.mobile && <PhoneLink value={client.mobile} whatsapp />}
            {client.phone && <PhoneLink value={client.phone} />}
          </span>
        }
        actions={
          <>
            {can(user, "matters", "create") && (
              <Link href={`/cases/new?clientId=${id}`} className={buttonVariants({ variant: "outline" })}>
                <Plus /> {t("cases.new")}
              </Link>
            )}
            {canEdit && (
              <Link href={`/clients/${id}/edit`} className={buttonVariants({ variant: "outline" })}>
                <Pencil /> {t("common.edit")}
              </Link>
            )}
            {can(user, "clients", "delete") && (
              <ActionButton variant="destructive" action={deleteClient.bind(null, id)} confirm={t("common.confirmDelete")} redirectTo="/clients">
                <Trash2 /> {t("common.delete")}
              </ActionButton>
            )}
          </>
        }
      />
      <Tabs tabs={tabs} active={tab} base={`/clients/${id}`} />
      {content}
    </>
  );
}
