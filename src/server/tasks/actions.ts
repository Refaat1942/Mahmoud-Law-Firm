"use server";

import { getTranslations } from "next-intl/server";
import { ActionError, defineAction } from "@/lib/action";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import type { CurrentUser } from "@/lib/session";
import { assertMatterAccess } from "../matters/access";
import { taskScope } from "./queries";
import { commentSchema, taskSchema } from "./schema";

const STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
type Status = (typeof STATUSES)[number];

async function findTask(user: CurrentUser, id: string) {
  const task = await prisma.task.findFirst({ where: { AND: [taskScope(user), { id }] } });
  if (!task) throw new ActionError("errors.notFound");
  return task;
}

/** Fills the client from the case and checks the case and parent task are reachable. */
async function normalize(user: CurrentUser, input: { matterId?: string; clientId?: string; parentId?: string }, selfId?: string) {
  let clientId = input.clientId;
  if (input.matterId) {
    await assertMatterAccess(user, input.matterId);
    const m = await prisma.matter.findUniqueOrThrow({ where: { id: input.matterId }, select: { clientId: true } });
    clientId = m.clientId;
  }
  if (input.parentId) {
    if (input.parentId === selfId) throw new ActionError("tasks.parentSelf");
    await findTask(user, input.parentId);
  }
  return { clientId };
}

async function notifyAssignee(assigneeId: string | null | undefined, actor: CurrentUser, task: { id: string; title: string }) {
  if (!assigneeId || assigneeId === actor.id) return;
  const assignee = await prisma.user.findUnique({ where: { id: assigneeId }, select: { locale: true } });
  if (!assignee) return;
  const t = await getTranslations({ locale: assignee.locale === "en" ? "en" : "ar", namespace: "tasks" });
  await notify({
    userId: assigneeId,
    type: "task",
    title: t("assignedTitle", { title: task.title }),
    body: t("assignedBody", { title: task.title, name: assignee.locale === "en" ? actor.nameEn || actor.nameAr : actor.nameAr }),
    link: `/tasks/${task.id}`,
  });
}

const completion = (status: Status, prev?: Status) =>
  status === "DONE" ? (prev === "DONE" ? {} : { completedAt: new Date() }) : { completedAt: null };

export const createTask = defineAction({ module: "tasks", perm: "create", entity: "Task", schema: taskSchema }, async (input, { user }) => {
  const { clientId } = await normalize(user, input);
  const task = await prisma.task.create({
    data: { ...input, clientId, createdById: user.id, ...completion(input.status) },
  });
  await notifyAssignee(task.assigneeId, user, task);
  return { id: task.id };
});

export const updateTask = defineAction({ module: "tasks", perm: "update", entity: "Task", schema: taskSchema }, async (input, { user }, id: string) => {
  const prev = await findTask(user, id);
  const { clientId } = await normalize(user, input, id);
  const dueChanged = (input.dueDate?.getTime() ?? null) !== (prev.dueDate?.getTime() ?? null);
  const task = await prisma.task.update({
    where: { id },
    data: { ...input, clientId, ...completion(input.status, prev.status), ...(dueChanged ? { reminderSent: false } : {}) },
  });
  if (task.assigneeId !== prev.assigneeId) await notifyAssignee(task.assigneeId, user, task);
  return { id };
});

export const setTaskStatus = defineAction({ module: "tasks", perm: "update", entity: "Task" }, async (input, { user }, id: string) => {
  const status = (input as { status?: string })?.status as Status;
  if (!STATUSES.includes(status)) throw new ActionError("errors.validation");
  const prev = await findTask(user, id);
  await prisma.task.update({ where: { id }, data: { status, ...completion(status, prev.status) } });
  return { id, audit: { status } };
});

export const deleteTask = defineAction({ module: "tasks", perm: "delete", entity: "Task" }, async (_i, { user }, id: string) => {
  await findTask(user, id);
  const now = new Date();
  await prisma.task.updateMany({ where: { OR: [{ id }, { parentId: id }], deletedAt: null }, data: { deletedAt: now } });
  return { id };
});

/** Anyone who can see the task may comment on it. */
export const addComment = defineAction({ module: "tasks", perm: "view", entity: "TaskComment", schema: commentSchema }, async (input, { user }, taskId: string) => {
  const task = await findTask(user, taskId);
  const c = await prisma.taskComment.create({ data: { taskId, userId: user.id, body: input.body } });
  const recipients = new Set([task.assigneeId, task.createdById].filter((u): u is string => !!u && u !== user.id));
  for (const userId of recipients) {
    await notify({ userId, type: "taskComment", title: task.title, body: input.body.slice(0, 300), link: `/tasks/${taskId}` });
  }
  return { id: c.id, audit: { taskId } };
});
