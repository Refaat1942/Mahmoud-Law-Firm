import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { CheckCircle2, CirclePlay, Plus, RotateCcw, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { plain } from "@/lib/plain";
import { can, requirePermission } from "@/lib/session";
import { localized, localizedTitle, startOfDay } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { Badge, STATUS_TONES } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ActionButton } from "@/components/action-button";
import { DataTable } from "@/components/data-table";
import { EntityForm } from "@/components/entity-form";
import { DateText } from "@/components/format";
import { DetailList, PageHeader, Section } from "@/components/page";
import { addComment, deleteTask, setTaskStatus, updateTask } from "@/server/tasks/actions";
import { taskScope } from "@/server/tasks/queries";
import { taskFields } from "../fields";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("tasks");
  const { id } = await params;
  const t = await getTranslations();
  const locale = await getLocale();
  const task = await prisma.task.findFirst({
    where: { AND: [taskScope(user), { id }] },
    include: {
      matter: true,
      client: true,
      assignee: true,
      createdBy: true,
      parent: true,
      subtasks: { where: { deletedAt: null }, include: { assignee: true }, orderBy: [{ status: "asc" }, { dueDate: "asc" }] },
      comments: { include: { user: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!task) notFound();
  const canEdit = can(user, "tasks", "update");
  const overdue = task.status !== "DONE" && task.dueDate && task.dueDate < startOfDay();
  const status = setTaskStatus.bind(null, id);

  return (
    <>
      <PageHeader
        title={task.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {task.parent && (
              <Link href={`/tasks/${task.parent.id}`} className="text-primary hover:underline dark:text-accent">
                {task.parent.title} ›
              </Link>
            )}
            <Badge tone={STATUS_TONES[task.status]}>{t(`enum.TaskStatus.${task.status}`)}</Badge>
            <Badge tone={STATUS_TONES[task.priority]}>{t(`enum.Priority.${task.priority}`)}</Badge>
            {overdue && <Badge tone="danger">{t("tasks.overdue")}</Badge>}
          </span>
        }
        actions={
          <>
            {canEdit && task.status === "TODO" && (
              <ActionButton variant="outline" action={status} payload={{ status: "IN_PROGRESS" }}>
                <CirclePlay /> {t("tasks.start")}
              </ActionButton>
            )}
            {canEdit && task.status !== "DONE" && (
              <ActionButton action={status} payload={{ status: "DONE" }}>
                <CheckCircle2 /> {t("tasks.markDone")}
              </ActionButton>
            )}
            {canEdit && task.status === "DONE" && (
              <ActionButton variant="outline" action={status} payload={{ status: "TODO" }}>
                <RotateCcw /> {t("tasks.reopen")}
              </ActionButton>
            )}
            {can(user, "tasks", "delete") && (
              <ActionButton variant="destructive" action={deleteTask.bind(null, id)} confirm={t("tasks.confirmDelete")} redirectTo="/tasks">
                <Trash2 /> {t("common.delete")}
              </ActionButton>
            )}
          </>
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Section title={t("common.details")}>
            <DetailList
              columns={2}
              items={[
                {
                  label: t("f.matter"),
                  value: task.matter && (
                    <Link href={`/cases/${task.matter.id}?tab=tasks`} className="text-primary hover:underline dark:text-accent">
                      {task.matter.fileNo} — {localizedTitle(task.matter, locale)}
                    </Link>
                  ),
                },
                {
                  label: t("f.client"),
                  value: task.client && (
                    <Link href={`/clients/${task.client.id}`} className="text-primary hover:underline dark:text-accent">
                      {localized(task.client, locale)}
                    </Link>
                  ),
                },
                { label: t("f.assignee"), value: localized(task.assignee, locale) },
                { label: t("f.dueDate"), value: task.dueDate && <DateText value={task.dueDate} /> },
                { label: t("tasks.createdBy"), value: localized(task.createdBy, locale) },
                { label: t("f.createdAt"), value: <DateText value={task.createdAt} /> },
                ...(task.completedAt ? [{ label: t("tasks.completedAt"), value: <DateText value={task.completedAt} withTime /> }] : []),
              ]}
            />
            {task.description && <p className="mt-4 whitespace-pre-wrap border-t pt-3 text-sm">{task.description}</p>}
          </Section>

          {!task.parentId && (
            <Section
              title={t("tasks.subtasks")}
              actions={
                can(user, "tasks", "create") && (
                  <Link href={`/tasks/new?parentId=${id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    <Plus /> {t("tasks.addSubtask")}
                  </Link>
                )
              }
            >
              <DataTable
                pageSize={10}
                emptyText={t("tasks.noSubtasks")}
                columns={[
                  { key: "title", label: t("f.title"), href: "/tasks/:id" },
                  { key: "assignee", label: t("f.assignee") },
                  { key: "dueDate", label: t("f.dueDate"), type: "date" },
                  { key: "status", label: t("f.status"), type: "badge", enumKey: "TaskStatus" },
                ]}
                rows={task.subtasks.map((s) => ({
                  id: s.id,
                  title: s.title,
                  assignee: localized(s.assignee, locale),
                  dueDate: s.dueDate?.toISOString() ?? "",
                  status: s.status,
                }))}
              />
            </Section>
          )}

          <Section title={t("tasks.comments")}>
            <ul className="mb-4 space-y-3">
              {task.comments.length === 0 && <li className="text-sm text-muted-foreground">{t("tasks.noComments")}</li>}
              {task.comments.map((c) => (
                <li key={c.id} className="rounded-lg bg-muted/50 p-3">
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{localized(c.user, locale)}</span>
                    <DateText value={c.createdAt} withTime />
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{c.body}</p>
                </li>
              ))}
            </ul>
            <EntityForm
              schema="comment"
              action={addComment.bind(null, id)}
              fields={[{ name: "body", label: t("f.comment"), type: "textarea", required: true }]}
              submitLabel={t("tasks.addComment")}
              columns={1}
              compact
              resetOnSuccess
            />
          </Section>
        </div>
        {canEdit && (
          <Section title={t("common.edit")}>
            <EntityForm
              fields={await taskFields(user, { parentOptions: task.parent ? [{ value: task.parent.id, label: task.parent.title }] : undefined })}
              schema="task"
              action={updateTask.bind(null, id)}
              defaultValues={plain(task)}
            />
          </Section>
        )}
      </div>
    </>
  );
}
