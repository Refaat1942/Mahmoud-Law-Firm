import { cache } from "react";
import { getLocale } from "next-intl/server";
import type { Prisma } from "@prisma/client";
import { auth } from "./auth";
import { prisma } from "./prisma";
import { redirect } from "@/i18n/navigation";
import type { Action, Module } from "./rbac";

export const getCurrentUser = cache(async () => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await prisma.user.findFirst({
    where: { id, isActive: true, deletedAt: null },
    include: { role: { include: { permissions: true } } },
  });
  if (!user) return null;
  const perms = new Set(user.role.permissions.map((p) => `${p.module}:${p.action}`));
  return {
    id: user.id,
    email: user.email,
    nameAr: user.nameAr,
    nameEn: user.nameEn,
    clientId: user.clientId,
    roleKey: user.role.key,
    roleNameAr: user.role.nameAr,
    roleNameEn: user.role.nameEn,
    scopeAll: user.role.scopeAll,
    totpEnabled: user.totpEnabled,
    perms,
  };
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export function can(user: CurrentUser | null, module: Module, action: Action = "view") {
  return !!user && user.perms.has(`${module}:${action}`);
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    const locale = await getLocale();
    redirect({ href: "/login", locale });
  }
  return user as CurrentUser;
}

export async function requireStaff() {
  const user = await requireUser();
  if (user.clientId) {
    const locale = await getLocale();
    redirect({ href: "/portal", locale });
  }
  return user;
}

export async function requirePermission(module: Module, action: Action = "view") {
  const user = await requireStaff();
  if (!can(user, module, action)) {
    const locale = await getLocale();
    redirect({ href: "/forbidden", locale });
  }
  return user;
}

/** Restricts matter queries to the matters a user may see. */
export function matterScope(user: CurrentUser): Prisma.MatterWhereInput {
  if (user.scopeAll) return { deletedAt: null };
  return {
    deletedAt: null,
    OR: [{ responsibleId: user.id }, { members: { some: { userId: user.id } } }],
  };
}
