import "server-only";
import type { Prisma } from "@prisma/client";
import { matterScope, type CurrentUser } from "@/lib/session";

/** Notices a user may see: all for scope-all roles; otherwise on their cases, or case-less ones they created or own. */
export function noticeScope(user: CurrentUser): Prisma.LegalNoticeWhereInput {
  if (user.scopeAll) return { deletedAt: null };
  return { deletedAt: null, OR: [{ matter: matterScope(user) }, { matterId: null, OR: [{ createdById: user.id }, { assigneeId: user.id }] }] };
}
