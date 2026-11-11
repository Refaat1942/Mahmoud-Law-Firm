"use server";

import { ActionError, defineAction } from "@/lib/action";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import { assertMatterAccess } from "../matters/access";
import { appointmentScope } from "./queries";
import { appointmentSchema } from "./schema";

async function normalize(user: CurrentUser, input: { matterId?: string; clientId?: string }) {
  if (!input.matterId) return input.clientId;
  await assertMatterAccess(user, input.matterId);
  return (await prisma.matter.findUniqueOrThrow({ where: { id: input.matterId }, select: { clientId: true } })).clientId;
}

export const createAppointment = defineAction({ module: "hearings", perm: "create", entity: "Appointment", schema: appointmentSchema }, async ({ attendeeIds, ...input }, { user }) => {
  const clientId = await normalize(user, input);
  const a = await prisma.appointment.create({
    data: { ...input, clientId, organizerId: user.id, attendees: { create: [...new Set(attendeeIds)].map((userId) => ({ userId })) } },
  });
  return { id: a.id };
});

export const updateAppointment = defineAction({ module: "hearings", perm: "update", entity: "Appointment", schema: appointmentSchema }, async ({ attendeeIds, ...input }, { user }, id: string) => {
  const prev = await prisma.appointment.findFirst({ where: { AND: [appointmentScope(user), { id }] } });
  if (!prev) throw new ActionError("errors.notFound");
  const clientId = await normalize(user, input);
  const moved = +prev.startAt !== +input.startAt;
  await prisma.$transaction([
    prisma.appointment.update({
      where: { id },
      data: { ...input, clientId: clientId ?? null, matterId: input.matterId ?? null, ...(moved ? { reminderSent: false } : {}) },
    }),
    prisma.appointmentAttendee.deleteMany({ where: { appointmentId: id } }),
    prisma.appointmentAttendee.createMany({ data: [...new Set(attendeeIds)].map((userId) => ({ appointmentId: id, userId })) }),
  ]);
  return { id };
});

export const deleteAppointment = defineAction({ module: "hearings", perm: "delete", entity: "Appointment" }, async (_i, { user }, id: string) => {
  const a = await prisma.appointment.findFirst({ where: { AND: [appointmentScope(user), { id }] } });
  if (!a) throw new ActionError("errors.notFound");
  await prisma.appointment.update({ where: { id }, data: { deletedAt: new Date() } });
  return { id };
});
