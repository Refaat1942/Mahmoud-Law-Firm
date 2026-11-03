import { getTranslations } from "next-intl/server";
import { Check, Trash2, Undo2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/session";
import { localized } from "@/lib/utils";
import { daysUntil, isoDate } from "@/lib/deadlines";
import { getDeadlinePresets } from "@/lib/settings";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { ActionButton } from "@/components/action-button";
import { EntityForm } from "@/components/entity-form";
import { DateText } from "@/components/format";
import { Section } from "@/components/page";
import { addDeadline, deleteDeadline, toggleDeadline } from "@/server/hearings/actions";
import { userOptions } from "@/server/options";
import type { TabProps } from "./types";

export async function DeadlinesTab({ matterId, user, locale }: TabProps) {
  const t = await getTranslations();
  const [deadlines, presets] = await Promise.all([
    prisma.deadline.findMany({ where: { matterId }, include: { assignee: true }, orderBy: { dueDate: "asc" } }),
    getDeadlinePresets(),
  ]);
  const canEdit = can(user, "hearings", "update");

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Section title={t("cases.deadlines")} className="lg:col-span-2">
        {deadlines.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("common.empty")}</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("f.title")}</Th>
                <Th>{t("f.startDate")}</Th>
                <Th>{t("f.days")}</Th>
                <Th>{t("f.dueDate")}</Th>
                <Th>{t("f.assignee")}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {deadlines.map((d) => {
                const left = daysUntil(d.dueDate);
                return (
                  <tr key={d.id} className={d.done ? "opacity-60" : ""}>
                    <Td className={d.done ? "line-through" : ""}>{d.title}</Td>
                    <Td>
                      <DateText value={d.startDate} />
                    </Td>
                    <Td>{d.days}</Td>
                    <Td>
                      <DateText value={d.dueDate} />{" "}
                      {!d.done && (
                        <Badge tone={left < 0 ? "danger" : left <= 3 ? "warning" : "info"}>
                          {left < 0 ? t("hearings.overdue") : t("clients.daysLeft", { days: left })}
                        </Badge>
                      )}
                    </Td>
                    <Td>{localized(d.assignee, locale)}</Td>
                    <Td className="whitespace-nowrap">
                      {canEdit && (
                        <ActionButton variant="ghost" size="icon" action={toggleDeadline.bind(null, d.id)} aria-label={t("hearings.markDone")}>
                          {d.done ? <Undo2 /> : <Check />}
                        </ActionButton>
                      )}
                      {can(user, "hearings", "delete") && !d.done && (
                        <ActionButton variant="ghost" size="icon" action={deleteDeadline.bind(null, d.id)} confirm={t("common.confirmDelete")} aria-label={t("common.delete")}>
                          <Trash2 />
                        </ActionButton>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Section>
      {can(user, "hearings", "create") && (
        <Section title={t("hearings.addDeadline")}>
          <p className="mb-3 text-xs text-muted-foreground">{t("hearings.deadlineHelp")}</p>
          <EntityForm
            columns={1}
            schema="deadline"
            action={addDeadline.bind(null, matterId)}
            resetOnSuccess
            submitLabel={t("common.add")}
            defaultValues={{ kind: presets[0]?.key ?? "CUSTOM", startDate: isoDate(new Date()) }}
            fields={[
              {
                name: "kind",
                label: t("f.deadlineKind"),
                type: "select",
                required: true,
                options: [
                  ...presets.map((p) => ({ value: p.key, label: `${localized(p, locale)} (${t("hearings.daysCount", { days: p.days })})` })),
                  { value: "CUSTOM", label: t("hearings.customDeadline") },
                ],
              },
              { name: "title", label: t("f.title"), help: t("hearings.presetHelp") },
              { name: "startDate", label: t("f.startDate"), type: "date", required: true, help: t("hearings.startDateHelp") },
              { name: "days", label: t("f.days"), type: "number", help: t("hearings.presetHelp") },
              { name: "assigneeId", label: t("f.assignee"), type: "select", options: await userOptions() },
            ]}
          />
        </Section>
      )}
    </div>
  );
}
