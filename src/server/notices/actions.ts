"use server";

import { getTranslations } from "next-intl/server";
import { ActionError, defineAction } from "@/lib/action";
import { prisma, type Tx } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import { computeDueDate, isoDate } from "@/lib/deadlines";
import { assertMatterAccess, logEvent } from "../matters/access";
import { noticeScope } from "./queries";
import { noticeSchema } from "./schema";

async function holidaySet(tx: Tx) {
  const rows = await tx.holiday.findMany();
  return new Set(rows.map((h) => h.date.toISOString().slice(0, 10)));
}

async function checkMatter(user: CurrentUser, clientId: string, matterId?: string) {
  if (!matterId) return;
  await assertMatterAccess(user, matterId);
  const m = await prisma.matter.findUniqueOrThrow({ where: { id: matterId }, select: { clientId: true } });
  if (m.clientId !== clientId) throw new ActionError("billing.matterClient");
}

/**
 * Keeps the notice's due date (service date + grace days, rolled past weekends and holidays) and, for a
 * notice on a case, the matching case deadline in step. A completed deadline is left alone.
 */
async function syncDeadline(tx: Tx, noticeId: string, userId: string) {
  const n = await tx.legalNotice.findUniqueOrThrow({ where: { id: noticeId } });
  const dueDate = n.servedAt && n.graceDays ? computeDueDate(n.servedAt, n.graceDays, await holidaySet(tx)) : null;
  const t = await getTranslations("notices");
  let deadlineId = n.deadlineId;
  if (deadlineId) {
    const d = await tx.deadline.findUnique({ where: { id: deadlineId } });
    if (!d) deadlineId = null;
    else if (!dueDate || !n.matterId || d.matterId !== n.matterId) {
      if (!d.done) await tx.deadline.delete({ where: { id: d.id } });
      deadlineId = null;
    } else if (!d.done && (+d.dueDate !== +dueDate || d.days !== n.graceDays)) {
      await tx.deadline.update({ where: { id: d.id }, data: { dueDate, startDate: n.servedAt!, days: n.graceDays!, title: t("deadlineTitle", { title: n.title }), reminderSent: false } });
    }
  }
  if (!deadlineId && dueDate && n.matterId) {
    const d = await tx.deadline.create({
      data: { matterId: n.matterId, kind: "NOTICE", title: t("deadlineTitle", { title: n.title }), startDate: n.servedAt!, days: n.graceDays!, dueDate, assigneeId: n.assigneeId ?? userId },
    });
    deadlineId = d.id;
    await logEvent(tx, n.matterId, "deadline", t("events.deadline", { title: n.title, date: isoDate(dueDate) }), userId);
  }
  const changed = +(n.dueDate ?? 0) !== +(dueDate ?? 0);
  await tx.legalNotice.update({ where: { id: noticeId }, data: { dueDate, deadlineId, ...(changed ? { reminderSent: false } : {}) } });
}

export const createNotice = defineAction({ module: "matters", perm: "create", entity: "LegalNotice", schema: noticeSchema }, async (input, { user }) => {
  await checkMatter(user, input.clientId, input.matterId);
  const t = await getTranslations("notices");
  const n = await prisma.$transaction(async (tx) => {
    const created = await tx.legalNotice.create({ data: { ...input, createdById: user.id } });
    if (input.matterId) await logEvent(tx, input.matterId, "notice", t(`events.${input.direction}`, { title: input.title, counterparty: input.counterparty }), user.id);
    await syncDeadline(tx, created.id, user.id);
    return created;
  });
  return { id: n.id };
});

export const updateNotice = defineAction({ module: "matters", perm: "update", entity: "LegalNotice", schema: noticeSchema }, async (input, { user }, id: string) => {
  const prev = await prisma.legalNotice.findFirst({ where: { AND: [noticeScope(user), { id }] } });
  if (!prev) throw new ActionError("errors.notFound");
  await checkMatter(user, input.clientId, input.matterId);
  const t = await getTranslations("notices");
  await prisma.$transaction(async (tx) => {
    await tx.legalNotice.update({ where: { id }, data: { ...input, matterId: input.matterId ?? null } });
    if (input.matterId && prev.status !== input.status)
      await logEvent(tx, input.matterId, "notice", t("events.status", { title: input.title, status: t(`statusLabel.${input.status}`) }), user.id);
    await syncDeadline(tx, id, user.id);
  });
  return { id };
});

export const deleteNotice = defineAction({ module: "matters", perm: "delete", entity: "LegalNotice" }, async (_i, { user }, id: string) => {
  const n = await prisma.legalNotice.findFirst({ where: { AND: [noticeScope(user), { id }] } });
  if (!n) throw new ActionError("errors.notFound");
  await prisma.$transaction(async (tx) => {
    await tx.legalNotice.update({ where: { id }, data: { deletedAt: new Date(), deadlineId: null } });
    if (n.deadlineId) await tx.deadline.deleteMany({ where: { id: n.deadlineId, done: false } });
  });
  return { id };
});
