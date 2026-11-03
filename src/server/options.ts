import "server-only";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { ENUMS, type EnumName } from "@/lib/enums";
import { matterScope, type CurrentUser } from "@/lib/session";
import { localized, localizedTitle } from "@/lib/utils";

export type Option = { value: string; label: string };

export async function enumOptions(name: EnumName): Promise<Option[]> {
  const t = await getTranslations("enum");
  return ENUMS[name].map((v) => ({ value: v, label: t(`${name}.${v}`) }));
}

export async function userOptions(opts: { staffOnly?: boolean } = { staffOnly: true }): Promise<Option[]> {
  const locale = await getLocale();
  const users = await prisma.user.findMany({
    where: { deletedAt: null, isActive: true, ...(opts.staffOnly ? { clientId: null } : {}) },
    orderBy: { nameAr: "asc" },
  });
  return users.map((u) => ({ value: u.id, label: localized(u, locale) }));
}

export async function clientOptions(): Promise<Option[]> {
  const locale = await getLocale();
  const rows = await prisma.client.findMany({ where: { deletedAt: null }, orderBy: { nameAr: "asc" }, take: 2000 });
  return rows.map((c) => ({ value: c.id, label: `${localized(c, locale)} (${c.code})` }));
}

export async function matterOptions(user: CurrentUser, where: { clientId?: string } = {}): Promise<Option[]> {
  const locale = await getLocale();
  const rows = await prisma.matter.findMany({
    where: { AND: [matterScope(user), where] },
    orderBy: { openedAt: "desc" },
    take: 2000,
  });
  return rows.map((m) => ({ value: m.id, label: `${m.fileNo} — ${localizedTitle(m, locale)}` }));
}

export async function courtOptions(): Promise<Option[]> {
  const locale = await getLocale();
  const rows = await prisma.court.findMany({ where: { isActive: true }, orderBy: { nameAr: "asc" } });
  return rows.map((c) => ({ value: c.id, label: localized(c, locale) }));
}

export async function matterTypeOptions(): Promise<Option[]> {
  const locale = await getLocale();
  const rows = await prisma.matterType.findMany({ where: { isActive: true }, orderBy: { nameAr: "asc" } });
  return rows.map((c) => ({ value: c.id, label: localized(c, locale) }));
}

export async function roleOptions(): Promise<Option[]> {
  const locale = await getLocale();
  const rows = await prisma.role.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map((r) => ({ value: r.id, label: localized(r, locale) }));
}

export async function accountOptions(type?: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE"): Promise<Option[]> {
  const locale = await getLocale();
  const rows = await prisma.account.findMany({ where: { isActive: true, ...(type ? { type } : {}) }, orderBy: { code: "asc" } });
  return rows.map((a) => ({ value: a.id, label: `${a.code} — ${localized(a, locale)}` }));
}

export async function bankOptions(): Promise<Option[]> {
  const locale = await getLocale();
  const rows = await prisma.bankAccount.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
  return rows.map((b) => ({ value: b.id, label: localized(b, locale) }));
}

export async function employeeOptions(): Promise<Option[]> {
  const locale = await getLocale();
  const rows = await prisma.employee.findMany({ where: { deletedAt: null, status: { not: "TERMINATED" } }, orderBy: { nameAr: "asc" } });
  return rows.map((e) => ({ value: e.id, label: `${localized(e, locale)} (${e.code})` }));
}

export async function partyOptions(): Promise<Option[]> {
  const rows = await prisma.party.findMany({ where: { deletedAt: null }, orderBy: { nameAr: "asc" }, take: 2000 });
  return rows.map((p) => ({ value: p.id, label: p.nameEn ? `${p.nameAr} / ${p.nameEn}` : p.nameAr }));
}
