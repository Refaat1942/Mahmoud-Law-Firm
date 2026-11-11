import { getTranslations } from "next-intl/server";
import { Plus, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/session";
import { executionSummary } from "@/lib/courts";
import { isoDate } from "@/lib/deadlines";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { ActionButton } from "@/components/action-button";
import { DataTable } from "@/components/data-table";
import { EntityForm } from "@/components/entity-form";
import { DateText, Money } from "@/components/format";
import { Section, StatCard } from "@/components/page";
import { enumOptions } from "@/server/options";
import { addExecutionAction, deleteExecutionAction } from "@/server/courts/actions";
import type { TabProps } from "./types";

/** Court requests/communications of the case and its execution log, with what came from the court flagged. */
export async function CourtTab({ matterId, user, canEdit }: TabProps) {
  const t = await getTranslations();
  const [filings, actions, updates] = await Promise.all([
    prisma.courtFiling.findMany({ where: { matterId, deletedAt: null }, orderBy: { createdAt: "desc" } }),
    prisma.executionAction.findMany({ where: { matterId, deletedAt: null }, orderBy: { date: "desc" } }),
    prisma.courtUpdate.count({ where: { matterId, status: "PENDING" } }),
  ]);
  const sum = executionSummary(actions);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("courts.collected")} value={<Money value={sum.collected.toString()} />} />
        <StatCard label={t("courts.courtFees")} value={<Money value={sum.fees.toString()} />} />
        <StatCard label={t("courts.activeTravelBans")} value={sum.activeTravelBans} />
        <StatCard label={t("courts.activeAttachments")} value={sum.activeAttachments} hint={updates ? t("courts.pendingUpdates", { count: updates }) : undefined} href={updates ? "/court-updates" : undefined} />
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Section title={t("courts.executionLog")} className="xl:col-span-2">
          {actions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>{t("f.date")}</Th>
                  <Th>{t("f.type")}</Th>
                  <Th>{t("f.title")}</Th>
                  <Th>{t("f.amount")}</Th>
                  <Th>{t("courts.source")}</Th>
                  {canEdit && <Th />}
                </tr>
              </thead>
              <tbody>
                {actions.map((a) => (
                  <tr key={a.id}>
                    <Td className="whitespace-nowrap">
                      <DateText value={a.date} />
                    </Td>
                    <Td>
                      <Badge tone="neutral">{t(`enum.ExecutionActionType.${a.type}`)}</Badge>
                    </Td>
                    <Td>
                      {a.title}
                      {a.details && <p className="text-xs text-muted-foreground">{a.details}</p>}
                    </Td>
                    <Td>{a.amount && <Money value={a.amount.toString()} />}</Td>
                    <Td>{a.source === "COURT" ? <Badge tone="info">{t("courts.fromCourt")}</Badge> : <Badge tone="neutral">{t("courts.fromOffice")}</Badge>}</Td>
                    {canEdit && (
                      <Td>
                        <ActionButton variant="ghost" size="icon" action={deleteExecutionAction.bind(null, a.id)} confirm={t("common.confirmDelete")} aria-label={t("common.delete")}>
                          <Trash2 />
                        </ActionButton>
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Section>
        {canEdit && (
          <Section title={t("courts.addAction")}>
            <EntityForm
              schema="executionAction"
              action={addExecutionAction.bind(null, matterId)}
              columns={1}
              resetOnSuccess
              defaultValues={{ type: "DECISION", date: isoDate(new Date()) }}
              fields={[
                { name: "type", label: t("f.type"), type: "select", options: await enumOptions("ExecutionActionType"), required: true },
                { name: "date", label: t("f.date"), type: "date", required: true },
                { name: "title", label: t("f.title"), required: true },
                { name: "amount", label: t("f.amount"), type: "money", help: t("courts.amountHelp") },
                { name: "details", label: t("f.details"), type: "textarea" },
              ]}
            />
          </Section>
        )}
      </div>
      <Section
        title={t("courts.filingsTitle")}
        actions={
          can(user, "matters", "create") && (
            <Link href={`/court-filings/new?matterId=${matterId}`} className={buttonVariants({ size: "sm" })}>
              <Plus /> {t("courts.newFiling")}
            </Link>
          )
        }
      >
        <DataTable
          pageSize={10}
          columns={[
            { key: "title", label: t("f.title"), href: "/court-filings/:id" },
            { key: "kind", label: t("f.type"), type: "badge", enumKey: "FilingKind" },
            { key: "direction", label: t("courts.direction"), type: "badge", enumKey: "FilingDirection" },
            { key: "submittedAt", label: t("courts.submittedAt"), type: "date" },
            { key: "followUpAt", label: t("courts.followUpAt"), type: "date" },
            { key: "status", label: t("f.status"), type: "badge", enumKey: "FilingStatus" },
          ]}
          rows={filings.map((f) => ({ id: f.id, title: f.title, kind: f.kind, direction: f.direction, submittedAt: f.submittedAt?.toISOString() ?? "", followUpAt: f.followUpAt?.toISOString() ?? "", status: f.status }))}
        />
      </Section>
    </div>
  );
}
