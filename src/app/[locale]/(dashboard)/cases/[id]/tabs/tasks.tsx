import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/session";
import { localized } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import type { TabProps } from "./types";

export async function TasksTab({ matterId, user, locale }: TabProps) {
  const t = await getTranslations();
  const tasks = await prisma.task.findMany({ where: { matterId, deletedAt: null, parentId: null }, include: { assignee: true }, orderBy: { dueDate: "asc" } });
  return (
    <div className="space-y-3">
      {can(user, "tasks", "create") && (
        <Link href={`/tasks/new?matterId=${matterId}`} className={buttonVariants()}>
          <Plus /> {t("tasks.new")}
        </Link>
      )}
      <DataTable
        columns={[
          { key: "title", label: t("f.title"), href: "/tasks/:id" },
          { key: "assignee", label: t("f.assignee") },
          { key: "priority", label: t("f.priority"), type: "badge", enumKey: "Priority" },
          { key: "dueDate", label: t("f.dueDate"), type: "date" },
          { key: "status", label: t("f.status"), type: "badge", enumKey: "TaskStatus" },
        ]}
        rows={tasks.map((x) => ({
          id: x.id,
          title: x.title,
          assignee: localized(x.assignee, locale),
          priority: x.priority,
          dueDate: x.dueDate?.toISOString() ?? "",
          status: x.status,
        }))}
      />
    </div>
  );
}
