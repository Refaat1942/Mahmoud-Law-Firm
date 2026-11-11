import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { matterScope, type CurrentUser } from "@/lib/session";
import { normalizeCaseNo } from "@/lib/courts";

export function filingScope(user: CurrentUser): Prisma.CourtFilingWhereInput {
  return { deletedAt: null, matter: matterScope(user) };
}

/** Matched updates follow case access; unmatched ones (case not identified yet) only reach scope-all roles. */
export function courtUpdateScope(user: CurrentUser): Prisma.CourtUpdateWhereInput {
  if (user.scopeAll) return {};
  return { matter: { is: matterScope(user) } };
}

/** Finds the case for a court case number among the cases the user can reach. */
export async function matchMatter(user: CurrentUser, courtCaseNo: string) {
  const key = normalizeCaseNo(courtCaseNo);
  const candidates = await prisma.matter.findMany({ where: { AND: [matterScope(user), { courtCaseNo: { not: null } }] }, select: { id: true, courtCaseNo: true } });
  return candidates.find((m) => normalizeCaseNo(m.courtCaseNo!) === key)?.id ?? null;
}
