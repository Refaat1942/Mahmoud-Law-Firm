import "server-only";
import type { Prisma } from "@prisma/client";
import { matterScope, type CurrentUser } from "@/lib/session";

/** Tasks a user may see: all for roles that see every matter; otherwise their own, ones they created, and ones on their matters. */
export function taskScope(user: CurrentUser): Prisma.TaskWhereInput {
  if (user.scopeAll) return { deletedAt: null };
  return {
    deletedAt: null,
    OR: [{ assigneeId: user.id }, { createdById: user.id }, { matter: matterScope(user) }],
  };
}
