import "server-only";
import type { Prisma } from "@prisma/client";
import { matterScope, type CurrentUser } from "@/lib/session";

/**
 * Documents a user may see: everything for roles that see every matter; otherwise documents on
 * their matters, client-level documents (no case), and anything they uploaded.
 */
export function documentScope(user: CurrentUser): Prisma.DocumentWhereInput {
  if (user.scopeAll) return { deletedAt: null };
  return {
    deletedAt: null,
    OR: [{ matterId: null }, { matter: matterScope(user) }, { uploadedById: user.id }],
  };
}

const INLINE_TYPES = /^(application\/pdf|image\/(png|jpe?g|gif|webp)|text\/plain)$/;

/** File types the browser can show in a tab instead of downloading. */
export const canPreview = (mimeType: string) => INLINE_TYPES.test(mimeType);
