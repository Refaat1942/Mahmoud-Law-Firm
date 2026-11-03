import "server-only";
import type { Prisma } from "@prisma/client";
import { can, matterScope, type CurrentUser } from "@/lib/session";

/** Approvers see every entry on matters they can reach; everyone else sees their own entries. */
export function timeScope(user: CurrentUser): Prisma.TimeEntryWhereInput {
  if (can(user, "time", "approve")) return { deletedAt: null, matter: matterScope(user) };
  return { deletedAt: null, userId: user.id };
}

export const EDITABLE: ("DRAFT" | "REJECTED")[] = ["DRAFT", "REJECTED"];
