import "server-only";
import type { Prisma } from "@prisma/client";
import { matterScope, type CurrentUser } from "@/lib/session";

/** Appointments a user may see: all for scope-all roles; otherwise ones they organise or attend, or on their cases. */
export function appointmentScope(user: CurrentUser): Prisma.AppointmentWhereInput {
  if (user.scopeAll) return { deletedAt: null };
  return { deletedAt: null, OR: [{ organizerId: user.id }, { attendees: { some: { userId: user.id } } }, { matter: matterScope(user) }] };
}
