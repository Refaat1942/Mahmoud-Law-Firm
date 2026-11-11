"use server";

import { getTranslations } from "next-intl/server";
import { ActionError, defineAction } from "@/lib/action";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { parseCourtUpdatesCsv } from "@/lib/courts";
import { isoDate } from "@/lib/deadlines";
import { assertMatterAccess, logEvent } from "../matters/access";
import { courtUpdateScope, filingScope, matchMatter } from "./queries";
import { applyUpdateSchema, courtUpdateSchema, executionActionSchema, filingSchema, updatesCsvSchema } from "./schema";

// ───────────── Court requests & communications ─────────────

export const createFiling = defineAction({ module: "matters", perm: "create", entity: "CourtFiling", schema: filingSchema }, async (input, { user }) => {
  await assertMatterAccess(user, input.matterId);
  const t = await getTranslations("courts");
  const f = await prisma.$transaction(async (tx) => {
    const created = await tx.courtFiling.create({ data: { ...input, createdById: user.id } });
    await logEvent(tx, input.matterId, "filing", t(`events.${input.kind}.${input.direction}`, { title: input.title }), user.id);
    return created;
  });
  return { id: f.id };
});

export const updateFiling = defineAction({ module: "matters", perm: "update", entity: "CourtFiling", schema: filingSchema }, async (input, { user }, id: string) => {
  const prev = await prisma.courtFiling.findFirst({ where: { AND: [filingScope(user), { id }] } });
  if (!prev) throw new ActionError("errors.notFound");
  await assertMatterAccess(user, input.matterId);
  const moved = +(prev.followUpAt ?? 0) !== +(input.followUpAt ?? 0) || +(prev.responseDueAt ?? 0) !== +(input.responseDueAt ?? 0);
  await prisma.courtFiling.update({ where: { id }, data: { ...input, ...(moved ? { reminderSent: false } : {}) } });
  return { id };
});

export const deleteFiling = defineAction({ module: "matters", perm: "delete", entity: "CourtFiling" }, async (_i, { user }, id: string) => {
  const f = await prisma.courtFiling.findFirst({ where: { AND: [filingScope(user), { id }] } });
  if (!f) throw new ActionError("errors.notFound");
  await prisma.courtFiling.update({ where: { id }, data: { deletedAt: new Date() } });
  return { id };
});

// ───────────── Execution actions ─────────────

export const addExecutionAction = defineAction({ module: "matters", perm: "update", entity: "ExecutionAction", schema: executionActionSchema }, async (input, { user }, matterId: string) => {
  await assertMatterAccess(user, matterId);
  const t = await getTranslations();
  const a = await prisma.$transaction(async (tx) => {
    const created = await tx.executionAction.create({ data: { ...input, matterId, createdById: user.id } });
    await logEvent(tx, matterId, "execution", `${t(`enum.ExecutionActionType.${input.type}`)}: ${input.title}`, user.id, input.details);
    return created;
  });
  return { id: a.id };
});

export const deleteExecutionAction = defineAction({ module: "matters", perm: "update", entity: "ExecutionAction" }, async (_i, { user }, id: string) => {
  const a = await prisma.executionAction.findFirstOrThrow({ where: { id, deletedAt: null } });
  await assertMatterAccess(user, a.matterId);
  await prisma.executionAction.update({ where: { id }, data: { deletedAt: new Date() } });
  return { id };
});

// ───────────── Court updates inbox ─────────────

/** Records an update read from a court portal or notice; it stays pending until reviewed and applied. */
export const createCourtUpdate = defineAction({ module: "matters", perm: "update", entity: "CourtUpdate", schema: courtUpdateSchema }, async (input, { user }) => {
  if (input.matterId) await assertMatterAccess(user, input.matterId);
  const matterId = input.matterId ?? (await matchMatter(user, input.courtCaseNo));
  const u = await prisma.courtUpdate.create({ data: { ...input, matterId, source: "manual", createdById: user.id } });
  return { id: u.id };
});

/** Bulk import of a CSV export; rows with an external reference already imported are skipped. */
export const importCourtUpdates = defineAction({ module: "matters", perm: "update", entity: "CourtUpdate", schema: updatesCsvSchema }, async ({ file }, { user }) => {
  const { rows, errors } = parseCourtUpdatesCsv(await file.text());
  if (!rows.length) return { data: { imported: 0, skipped: 0, errors }, audit: { errors: errors.length } };
  let imported = 0;
  for (const r of rows) {
    if (r.externalId && (await prisma.courtUpdate.findUnique({ where: { source_externalId: { source: "csv", externalId: r.externalId } } }))) continue;
    await prisma.courtUpdate.create({ data: { ...r, source: "csv", matterId: await matchMatter(user, r.courtCaseNo), createdById: user.id } });
    imported++;
  }
  return { data: { imported, skipped: rows.length - imported, errors }, audit: { imported, errors: errors.length, file: file.name } };
});

/**
 * Applies a reviewed update to its case: the change is recorded as coming from the court, the case team is
 * notified, and an optional follow-up task is created. Nothing is changed before this explicit step.
 */
export const applyCourtUpdate = defineAction({ module: "matters", perm: "update", entity: "CourtUpdate", schema: applyUpdateSchema }, async (input, { user }, id: string) => {
  const u = await prisma.courtUpdate.findFirst({ where: { AND: [courtUpdateScope(user), { id }] } });
  if (!u) throw new ActionError("errors.notFound");
  if (u.status !== "PENDING") throw new ActionError("courts.alreadyReviewed");
  await assertMatterAccess(user, input.matterId);
  const t = await getTranslations();
  const m = await prisma.matter.findUniqueOrThrow({ where: { id: input.matterId }, include: { members: true } });
  const label = t("courts.fromCourt");
  await prisma.$transaction(async (tx) => {
    if (u.kind === "HEARING") {
      await tx.hearing.create({ data: { matterId: m.id, date: u.nextHearingAt ?? u.occurredAt, courtId: m.courtId, lawyerId: m.responsibleId, purpose: u.title, notes: u.details, source: "COURT" } });
    }
    if (u.kind === "DECISION" && u.nextHearingAt) {
      await tx.hearing.create({ data: { matterId: m.id, date: u.nextHearingAt, courtId: m.courtId, lawyerId: m.responsibleId, notes: u.title, source: "COURT" } });
    }
    if (u.kind === "EXECUTION" && u.executionType) {
      await tx.executionAction.create({
        data: { matterId: m.id, type: u.executionType, date: u.occurredAt, title: u.title, details: u.details, amount: u.amount, source: "COURT", courtUpdateId: u.id, createdById: user.id },
      });
    }
    await tx.matterEvent.create({
      data: { matterId: m.id, type: "court", title: `${label} · ${t(`enum.CourtUpdateKind.${u.kind}`)}: ${u.title}`, details: [u.details, u.nextHearingAt && `${t("courts.nextHearing")}: ${isoDate(u.nextHearingAt)}`].filter(Boolean).join("\n") || null, userId: user.id, source: "COURT" },
    });
    if (input.createTask && input.taskTitle && input.taskDueDate) {
      await tx.task.create({
        data: { title: input.taskTitle, dueDate: input.taskDueDate, matterId: m.id, clientId: m.clientId, assigneeId: m.responsibleId ?? user.id, createdById: user.id, priority: "HIGH", description: u.title },
      });
    }
    await tx.courtUpdate.update({ where: { id }, data: { status: "APPLIED", matterId: m.id, appliedAt: new Date(), appliedById: user.id } });
  });
  const recipients = new Set([m.responsibleId, ...m.members.map((x) => x.userId)].filter((x): x is string => !!x && x !== user.id));
  for (const userId of recipients)
    await notify({ userId, type: "courtUpdate", title: `${label}: ${m.fileNo}`, body: `${t(`enum.CourtUpdateKind.${u.kind}`)} — ${u.title}`, link: `/cases/${m.id}` });
  return { id, audit: { matterId: m.id, kind: u.kind, task: input.createTask } };
});

export const dismissCourtUpdate = defineAction({ module: "matters", perm: "update", entity: "CourtUpdate" }, async (_i, { user }, id: string) => {
  const u = await prisma.courtUpdate.findFirst({ where: { AND: [courtUpdateScope(user), { id }] } });
  if (!u || u.status !== "PENDING") throw new ActionError("courts.alreadyReviewed");
  await prisma.courtUpdate.update({ where: { id }, data: { status: "DISMISSED", appliedAt: new Date(), appliedById: user.id } });
  return { id };
});
