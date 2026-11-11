"use server";

import { hash, verify } from "@node-rs/argon2";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { z } from "zod";
import { ActionError, defineAction } from "@/lib/action";
import { prisma } from "@/lib/prisma";
import { ACTIONS, MODULES } from "@/lib/rbac";
import { getCurrentUser } from "@/lib/session";
import { audit } from "@/lib/audit";
import { getOffice } from "@/lib/settings";
import { notificationPrefsSchema, passwordChangeSchema, profileSchema, roleSchema, totpSchema, userCreateSchema, userUpdateSchema } from "./schema";

export const createUser = defineAction({ module: "users", perm: "create", entity: "User", schema: userCreateSchema }, async (input, { user }) => {
  const { password, ...data } = input;
  const created = await prisma.user.create({
    data: { ...data, clientId: data.clientId ?? null, passwordHash: await hash(password), createdById: user.id },
  });
  return { id: created.id, audit: { ...data } };
});

export const updateUser = defineAction(
  { module: "users", perm: "update", entity: "User", schema: userUpdateSchema },
  async (input, { user }, id: string) => {
    const { password, ...data } = input;
    if (id === user.id && !data.isActive) throw new ActionError("errors.selfDeactivate");
    await prisma.user.update({
      where: { id },
      data: { ...data, clientId: data.clientId ?? null, ...(password ? { passwordHash: await hash(password), failedLogins: 0, lockedUntil: null } : {}) },
    });
    return { id, audit: { ...data, passwordChanged: !!password } };
  },
);

export const deleteUser = defineAction({ module: "users", perm: "delete", entity: "User" }, async (_i, { user }, id: string) => {
  if (id === user.id) throw new ActionError("errors.selfDeactivate");
  await prisma.user.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  return { id };
});

export const unlockUser = defineAction({ module: "users", perm: "update", entity: "User" }, async (_i, _c, id: string) => {
  await prisma.user.update({ where: { id }, data: { failedLogins: 0, lockedUntil: null } });
  return { id };
});

export const resetTotp = defineAction({ module: "users", perm: "update", entity: "User" }, async (_i, _c, id: string) => {
  await prisma.user.update({ where: { id }, data: { totpEnabled: false, totpSecret: null } });
  return { id };
});

export const createRole = defineAction({ module: "users", perm: "create", entity: "Role", schema: roleSchema }, async (input) => {
  const role = await prisma.role.create({ data: input });
  return { id: role.id };
});

export const updateRole = defineAction({ module: "users", perm: "update", entity: "Role", schema: roleSchema }, async (input, _c, id: string) => {
  const role = await prisma.role.findUniqueOrThrow({ where: { id } });
  await prisma.role.update({ where: { id }, data: { ...input, key: role.isSystem ? role.key : input.key } });
  return { id };
});

export const deleteRole = defineAction({ module: "users", perm: "delete", entity: "Role" }, async (_i, _c, id: string) => {
  const role = await prisma.role.findUniqueOrThrow({ where: { id }, include: { _count: { select: { users: true } } } });
  if (role.isSystem || role._count.users > 0) throw new ActionError("errors.inUse");
  await prisma.role.delete({ where: { id } });
  return { id };
});

const matrixSchema = z.object({ permissions: z.array(z.string()) });

export const saveRolePermissions = defineAction(
  { module: "users", perm: "update", entity: "Permission", schema: matrixSchema },
  async ({ permissions }, _c, roleId: string) => {
    const valid = permissions
      .map((p) => p.split(":"))
      .filter(([m, a]) => (MODULES as readonly string[]).includes(m) && (ACTIONS as readonly string[]).includes(a));
    await prisma.$transaction([
      prisma.permission.deleteMany({ where: { roleId } }),
      prisma.permission.createMany({ data: valid.map(([module, action]) => ({ roleId, module, action })) }),
    ]);
    return { id: roleId, audit: { permissions } };
  },
);

// ───── Own profile (any signed-in user) ─────

async function self() {
  const user = await getCurrentUser();
  if (!user) throw new ActionError("errors.unauthorized");
  return user;
}

type Result = { ok: true; data?: unknown } | { ok: false; error: string; fieldErrors?: Record<string, string> };

const fieldErrors = (e: z.ZodError) => Object.fromEntries(e.issues.map((i) => [i.path.join("."), i.message]));

export async function updateProfile(input: unknown): Promise<Result> {
  const user = await self();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "errors.validation", fieldErrors: fieldErrors(parsed.error) };
  await prisma.user.update({ where: { id: user.id }, data: parsed.data });
  await audit({ userId: user.id, action: "update", entity: "Profile", entityId: user.id });
  return { ok: true };
}

export async function changePassword(input: unknown): Promise<Result> {
  const user = await self();
  const parsed = passwordChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "errors.validation", fieldErrors: fieldErrors(parsed.error) };
  const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verify(row.passwordHash, parsed.data.current))) return { ok: false, error: "errors.wrongPassword", fieldErrors: { current: "errors.wrongPassword" } };
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hash(parsed.data.next) } });
  await audit({ userId: user.id, action: "password_change", entity: "User", entityId: user.id });
  return { ok: true };
}

/** Generates a new TOTP secret (not active until verified) and returns its QR code. */
export async function startTotpSetup(): Promise<{ qr: string; secret: string }> {
  const user = await self();
  const office = await getOffice();
  const secret = authenticator.generateSecret();
  await prisma.user.update({ where: { id: user.id }, data: { totpSecret: secret, totpEnabled: false } });
  const uri = authenticator.keyuri(user.email, office.nameEn, secret);
  return { qr: await QRCode.toDataURL(uri), secret };
}

export async function confirmTotp(input: unknown): Promise<Result> {
  const user = await self();
  const parsed = totpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "errors.validation", fieldErrors: fieldErrors(parsed.error) };
  const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!row.totpSecret || !authenticator.verify({ token: parsed.data.token, secret: row.totpSecret })) {
    return { ok: false, error: "auth.errors.otp_invalid", fieldErrors: { token: "auth.errors.otp_invalid" } };
  }
  await prisma.user.update({ where: { id: user.id }, data: { totpEnabled: true } });
  await audit({ userId: user.id, action: "totp_enable", entity: "User", entityId: user.id });
  return { ok: true };
}

export async function disableTotp(): Promise<Result> {
  const user = await self();
  await prisma.user.update({ where: { id: user.id }, data: { totpEnabled: false, totpSecret: null } });
  await audit({ userId: user.id, action: "totp_disable", entity: "User", entityId: user.id });
  return { ok: true };
}

export async function markNotificationsRead(): Promise<Result> {
  const user = await self();
  await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  return { ok: true };
}

/** The signed-in user's notification channels: WhatsApp opt-in and email per notification type. */
export async function updateNotificationPrefs(input: unknown): Promise<Result> {
  const user = await self();
  const parsed = notificationPrefsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "errors.validation", fieldErrors: fieldErrors(parsed.error) };
  await prisma.user.update({ where: { id: user.id }, data: { notificationPrefs: parsed.data } });
  await audit({ userId: user.id, action: "update", entity: "NotificationPrefs", entityId: user.id, data: parsed.data });
  return { ok: true };
}
