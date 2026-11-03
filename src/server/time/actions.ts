"use server";

import { z } from "zod";
import { ActionError, defineAction } from "@/lib/action";
import { prisma } from "@/lib/prisma";
import { can, type CurrentUser } from "@/lib/session";
import { getOffice } from "@/lib/settings";
import { hoursToMinutes, resolveRate } from "@/lib/time";
import { assertMatterAccess } from "../matters/access";
import { EDITABLE, timeScope } from "./queries";
import { rateSchema, timeEntrySchema } from "./schema";

async function rateFor(userId: string, matterId: string) {
  const matter = await prisma.matter.findUniqueOrThrow({ where: { id: matterId }, include: { feeAgreement: true } });
  const [userClient, client, own, office] = await Promise.all([
    prisma.rate.findFirst({ where: { userId, clientId: matter.clientId } }),
    prisma.rate.findFirst({ where: { userId: null, clientId: matter.clientId } }),
    prisma.rate.findFirst({ where: { userId, clientId: null } }),
    getOffice(),
  ]);
  const fa = matter.feeAgreement;
  return resolveRate({
    agreement: fa?.type === "HOURLY" ? fa.hourlyRate : null,
    userClient: userClient?.amount,
    client: client?.amount,
    user: own?.amount,
    office: office.defaultHourlyRate,
  }).rate;
}

/** Owners edit their own draft or rejected entries; approvers may edit any entry that is not billed. */
async function findEditable(user: CurrentUser, id: string) {
  const e = await prisma.timeEntry.findFirst({ where: { AND: [timeScope(user), { id }] } });
  if (!e) throw new ActionError("errors.notFound");
  const approver = can(user, "time", "approve");
  if (e.status === "BILLED" || (!approver && (e.userId !== user.id || !EDITABLE.includes(e.status as never)))) throw new ActionError("time.locked");
  return e;
}

export const createTimeEntry = defineAction({ module: "time", perm: "create", entity: "TimeEntry", schema: timeEntrySchema }, async ({ hours, ...input }, { user }) => {
  await assertMatterAccess(user, input.matterId);
  const e = await prisma.timeEntry.create({
    data: { ...input, userId: user.id, minutes: hoursToMinutes(hours), rate: await rateFor(user.id, input.matterId) },
  });
  return { id: e.id };
});

export const updateTimeEntry = defineAction({ module: "time", perm: "update", entity: "TimeEntry", schema: timeEntrySchema }, async ({ hours, ...input }, { user }, id: string) => {
  const prev = await findEditable(user, id);
  await assertMatterAccess(user, input.matterId);
  const rate = input.matterId === prev.matterId ? prev.rate : await rateFor(prev.userId, input.matterId);
  // An edited rejected entry goes back to draft so it is resubmitted.
  await prisma.timeEntry.update({ where: { id }, data: { ...input, minutes: hoursToMinutes(hours), rate, ...(prev.status === "REJECTED" ? { status: "DRAFT" } : {}) } });
  return { id };
});

export const deleteTimeEntry = defineAction({ module: "time", perm: "delete", entity: "TimeEntry" }, async (_i, { user }, id: string) => {
  await findEditable(user, id);
  await prisma.timeEntry.update({ where: { id }, data: { deletedAt: new Date() } });
  return { id };
});

const idsSchema = z.object({ ids: z.array(z.string()).optional() });

/** Submits the given entries, or all of the user's drafts when no ids are passed. */
export const submitTime = defineAction({ module: "time", perm: "create", entity: "TimeEntry", schema: idsSchema }, async ({ ids }, { user }) => {
  const res = await prisma.timeEntry.updateMany({
    where: { deletedAt: null, userId: user.id, status: { in: EDITABLE }, ...(ids ? { id: { in: ids } } : {}) },
    data: { status: "SUBMITTED" },
  });
  return { data: { count: res.count }, audit: { ids, count: res.count } };
});

const reviewSchema = z.object({ ids: z.array(z.string()).optional(), userId: z.string().optional(), decision: z.enum(["APPROVED", "REJECTED"]) });

/** Approves or rejects submitted entries: the given ids, or every submitted entry (optionally for one lawyer). */
export const reviewTime = defineAction({ module: "time", perm: "approve", entity: "TimeEntry", schema: reviewSchema }, async ({ ids, userId, decision }, { user }) => {
  const res = await prisma.timeEntry.updateMany({
    where: { AND: [timeScope(user), { status: "SUBMITTED" }, ids ? { id: { in: ids } } : {}, userId ? { userId } : {}] },
    data: decision === "APPROVED" ? { status: "APPROVED", approvedById: user.id, approvedAt: new Date() } : { status: "REJECTED", approvedById: user.id, approvedAt: null },
  });
  return { data: { count: res.count }, audit: { ids, userId, decision, count: res.count } };
});

export const saveRate = defineAction({ module: "time", perm: "approve", entity: "Rate", schema: rateSchema }, async (input) => {
  const userId = input.userId ?? null;
  const clientId = input.clientId ?? null;
  // Prisma cannot upsert on a compound unique with nulls, so look the row up first.
  const existing = await prisma.rate.findFirst({ where: { userId, clientId } });
  const r = existing
    ? await prisma.rate.update({ where: { id: existing.id }, data: { amount: input.amount } })
    : await prisma.rate.create({ data: { userId, clientId, amount: input.amount } });
  return { id: r.id };
});

export const deleteRate = defineAction({ module: "time", perm: "approve", entity: "Rate" }, async (_i, _c, id: string) => {
  await prisma.rate.delete({ where: { id } });
  return { id };
});
