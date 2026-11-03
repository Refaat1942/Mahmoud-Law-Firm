import { getLocale, getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/session";
import { localized, localizedTitle, startOfDay } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { PageHeader, Tabs } from "@/components/page";
import { enumOptions } from "@/server/options";
import { taskScope } from "@/server/tasks/queries";

const TABS = ["mine", "open", "overdue", "done"] as const;

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requirePermission("tasks");
  const t = await getTranslations();
  const locale = await getLocale();
  const requested = (await searchParams).tab;
  const tab = TABS.find((k) => k === requested) ?? "mine";

  const filter: Record<(typeof TABS)[number], Prisma.TaskWhereInput> = {
    mine: { assigneeId: user.id, status: { not: "DONE" } },
    open: { status: { not: "DONE" } },
    overdue: { status: { not: "DONE" }, dueDate: { lt: startOfDay() } },
    done: { status: "DONE" },
  };
  const tasks = await prisma.task.findMany({
    where: { AND: [taskScope(user), filter[tab]] },
    include: { assignee: true, matter: true, client: true, parent: true, _count: { select: { subtasks: { where: { deletedAt: null } } } } },
    orderBy: tab === "done" ? [{ completedAt: "desc" }] : [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: 1000,
  });
  const rows = tasks.map((x) => ({
    id: x.id,
    title: x.parent ? `${x.parent.title} › ${x.title}` : x.title,
    matter: x.matter ? `${x.matter.fileNo} — ${localizedTitle(x.matter, locale)}` : "",
    matterId: x.matterId ?? "",
    client: localized(x.client, locale),
    assignee: localized(x.assignee, locale),
    priority: x.priority,
    dueDate: x.dueDate?.toISOString() ?? "",
    subtasks: x._count.subtasks,
    status: x.status,
    completedAt: x.completedAt?.toISOString() ?? "",
  }));

  return (
    <>
      <PageHeader
        title={t("tasks.title")}
        actions={
          can(user, "tasks", "create") && (
            <Link href="/tasks/new" className={buttonVariants()}>
              <Plus /> {t("tasks.new")}
            </Link>
          )
        }
      />
      <Tabs base="/tasks" active={tab} tabs={TABS.map((key) => ({ key, label: t(`tasks.tabs.${key}`) }))} />
      <DataTable
        exportName={`tasks-${tab}`}
        emptyText={t("tasks.empty")}
        filters={[
          { key: "priority", label: t("f.priority"), options: await enumOptions("Priority") },
          ...(tab === "done" ? [] : [{ key: "status", label: t("f.status"), options: (await enumOptions("TaskStatus")).filter((o) => o.value !== "DONE") }]),
          ...(tab === "mine" ? [] : [{ key: "assignee", label: t("f.assignee"), options: [...new Set(rows.map((r) => r.assignee).filter(Boolean))].map((v) => ({ value: v, label: v })) }]),
        ]}
        columns={[
          { key: "title", label: t("f.title"), href: "/tasks/:id" },
          { key: "matter", label: t("f.matter"), href: "/cases/:matterId" },
          { key: "client", label: t("f.client") },
          ...(tab === "mine" ? [] : [{ key: "assignee", label: t("f.assignee") }]),
          { key: "priority", label: t("f.priority"), type: "badge" as const, enumKey: "Priority" },
          { key: "dueDate", label: t("f.dueDate"), type: "date" as const },
          { key: "subtasks", label: t("tasks.subtasks"), type: "number" as const },
          tab === "done"
            ? { key: "completedAt", label: t("tasks.completedAt"), type: "date" as const }
            : { key: "status", label: t("f.status"), type: "badge" as const, enumKey: "TaskStatus" },
        ]}
        rows={rows}
      />
    </>
  );
}
