"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { ActionError, defineAction } from "@/lib/action";
import { prisma } from "@/lib/prisma";
import { getDeadlinePresets } from "@/lib/settings";
import { computeDueDate, isoDate } from "@/lib/deadlines";
import { assertMatterAccess, logEvent } from "../matters/access";
import { deadlineSchema, decisionSchema, hearingSchema } from "./schema";

async function holidaySet() {
  const rows = await prisma.holiday.findMany();
  return new Set(rows.map((h) => h.date.toISOString().slice(0, 10)));
}

export const createHearing = defineAction({ module: "hearings", perm: "create", entity: "Hearing", schema: hearingSchema }, async (input, { user }) => {
  await assertMatterAccess(user, input.matterId);
  const t = await getTranslations("hearings");
  const matter = await prisma.matter.findUniqueOrThrow({ where: { id: input.matterId } });
  const h = await prisma.$transaction(async (tx) => {
    const created = await tx.hearing.create({
      data: { ...input, courtId: input.courtId ?? matter.courtId, lawyerId: input.lawyerId ?? matter.responsibleId },
    });
    await logEvent(tx, input.matterId, "hearing", t("events.scheduled", { date: isoDate(input.date) }), user.id, input.purpose);
    return created;
  });
  return { id: h.id };
});

export const updateHearing = defineAction({ module: "hearings", perm: "update", entity: "Hearing", schema: hearingSchema }, async (input, { user }, id: string) => {
  await assertMatterAccess(user, input.matterId);
  await prisma.hearing.update({ where: { id }, data: { ...input, reminderSent: false } });
  return { id };
});

export const deleteHearing = defineAction({ module: "hearings", perm: "delete", entity: "Hearing" }, async (_i, { user }, id: string) => {
  const h = await prisma.hearing.findUniqueOrThrow({ where: { id } });
  await assertMatterAccess(user, h.matterId);
  await prisma.hearing.update({ where: { id }, data: { deletedAt: new Date() } });
  return { id };
});

/** Records what happened at a hearing; a next date automatically schedules the following hearing. */
export const recordDecision = defineAction({ module: "hearings", perm: "update", entity: "Hearing", schema: decisionSchema }, async (input, { user }, id: string) => {
  const h = await prisma.hearing.findUniqueOrThrow({ where: { id }, include: { next: true } });
  await assertMatterAccess(user, h.matterId);
  const t = await getTranslations();
  const next = await prisma.$transaction(async (tx) => {
    await tx.hearing.update({ where: { id }, data: { status: input.status, decision: input.decision } });
    await logEvent(
      tx,
      h.matterId,
      "decision",
      t("hearings.events.decision", { date: isoDate(h.date), status: t(`enum.HearingStatus.${input.status}`) }),
      user.id,
      input.decision,
    );
    if (!input.nextDate) return null;
    if (h.next) {
      return tx.hearing.update({ where: { id: h.next.id }, data: { date: input.nextDate, purpose: input.nextPurpose ?? h.next.purpose, reminderSent: false } });
    }
    const created = await tx.hearing.create({
      data: {
        matterId: h.matterId,
        date: input.nextDate,
        courtId: h.courtId,
        room: h.room,
        lawyerId: h.lawyerId,
        purpose: input.nextPurpose,
        previousId: h.id,
      },
    });
    await logEvent(tx, h.matterId, "hearing", t("hearings.events.scheduled", { date: isoDate(input.nextDate) }), user.id, input.nextPurpose);
    return created;
  });
  return { id: next?.id ?? id };
});

export const addDeadline = defineAction({ module: "hearings", perm: "create", entity: "Deadline", schema: deadlineSchema }, async (input, { user }, matterId: string) => {
  await assertMatterAccess(user, matterId);
  const preset = (await getDeadlinePresets()).find((p) => p.key === input.kind);
  const locale = await getLocale();
  const days = input.days ?? preset?.days ?? 0;
  const title = input.title ?? (preset ? (locale === "en" ? preset.nameEn : preset.nameAr) : input.kind);
  if (days < 1) throw new ActionError("v.required");
  const dueDate = computeDueDate(input.startDate, days, await holidaySet());
  const t = await getTranslations("hearings");
  const d = await prisma.$transaction(async (tx) => {
    const created = await tx.deadline.create({
      data: { kind: input.kind, startDate: input.startDate, title, days, matterId, dueDate, assigneeId: input.assigneeId ?? user.id },
    });
    await logEvent(tx, matterId, "deadline", t("events.deadline", { title, date: isoDate(dueDate) }), user.id);
    return created;
  });
  return { id: d.id, data: { dueDate: d.dueDate.toISOString() } };
});

export const toggleDeadline = defineAction({ module: "hearings", perm: "update", entity: "Deadline" }, async (_i, { user }, id: string) => {
  const d = await prisma.deadline.findUniqueOrThrow({ where: { id } });
  await assertMatterAccess(user, d.matterId);
  await prisma.deadline.update({ where: { id }, data: { done: !d.done } });
  return { id };
});

export const deleteDeadline = defineAction({ module: "hearings", perm: "delete", entity: "Deadline" }, async (_i, { user }, id: string) => {
  const d = await prisma.deadline.findUniqueOrThrow({ where: { id } });
  await assertMatterAccess(user, d.matterId);
  if (d.done) throw new ActionError("hearings.deadlineDone");
  await prisma.deadline.delete({ where: { id } });
  return { id };
});
