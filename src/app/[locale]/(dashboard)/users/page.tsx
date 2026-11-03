import { getLocale, getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, requirePermission } from "@/lib/session";
import { localized } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { PageHeader, Tabs } from "@/components/page";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requirePermission("users");
  const t = await getTranslations();
  const locale = await getLocale();
  const tab = (await searchParams).tab ?? "users";

  const tabs = [
    { key: "users", label: t("users.title") },
    { key: "roles", label: t("users.roles") },
    { key: "audit", label: t("users.audit") },
  ];

  let content: React.ReactNode;
  if (tab === "roles") {
    const roles = await prisma.role.findMany({ include: { _count: { select: { users: true, permissions: true } } }, orderBy: { createdAt: "asc" } });
    content = (
      <DataTable
        exportName="roles"
        columns={[
          { key: "name", label: t("f.name"), href: "/users/roles/:id" },
          { key: "key", label: t("f.key") },
          { key: "scopeAll", label: t("f.scopeAll"), type: "bool" },
          { key: "users", label: t("users.title"), type: "number" },
          { key: "permissions", label: t("users.permissions"), type: "number" },
        ]}
        rows={roles.map((r) => ({ id: r.id, name: localized(r, locale), key: r.key, scopeAll: r.scopeAll, users: r._count.users, permissions: r._count.permissions }))}
      />
    );
  } else if (tab === "audit") {
    const logs = await prisma.auditLog.findMany({ include: { user: true }, orderBy: { createdAt: "desc" }, take: 1000 });
    content = (
      <DataTable
        exportName="audit-log"
        pageSize={50}
        columns={[
          { key: "createdAt", label: t("f.date"), type: "datetime" },
          { key: "user", label: t("f.user") },
          { key: "action", label: t("f.action") },
          { key: "entity", label: t("f.entity") },
          { key: "entityId", label: t("f.recordId") },
          { key: "ip", label: "IP" },
        ]}
        rows={logs.map((l) => ({
          id: l.id,
          createdAt: l.createdAt.toISOString(),
          user: l.user ? localized(l.user, locale) : "",
          action: l.action,
          entity: l.entity,
          entityId: l.entityId ?? "",
          ip: l.ip ?? "",
        }))}
      />
    );
  } else {
    const users = await prisma.user.findMany({ where: { deletedAt: null }, include: { role: true, client: true }, orderBy: { createdAt: "asc" } });
    content = (
      <DataTable
        exportName="users"
        filters={[{ key: "role", label: t("f.role"), options: [...new Set(users.map((u) => localized(u.role, locale)))].map((r) => ({ value: r, label: r })) }]}
        columns={[
          { key: "name", label: t("f.name"), href: "/users/:id" },
          { key: "email", label: t("f.email") },
          { key: "role", label: t("f.role") },
          { key: "client", label: t("f.client") },
          { key: "isActive", label: t("f.isActive"), type: "bool" },
          { key: "totp", label: t("users.twoFactor"), type: "bool" },
          { key: "lastLoginAt", label: t("f.lastLoginAt"), type: "datetime" },
        ]}
        rows={users.map((u) => ({
          id: u.id,
          name: localized(u, locale),
          email: u.email,
          role: localized(u.role, locale),
          client: u.client ? localized(u.client, locale) : "",
          isActive: u.isActive,
          totp: u.totpEnabled,
          lastLoginAt: u.lastLoginAt?.toISOString() ?? "",
        }))}
      />
    );
  }

  return (
    <>
      <PageHeader
        title={t("users.title")}
        actions={
          can(user, "users", "create") &&
          tab !== "audit" && (
            <Link href={tab === "roles" ? "/users/roles/new" : "/users/new"} className={buttonVariants()}>
              <Plus /> {tab === "roles" ? t("users.newRole") : t("users.new")}
            </Link>
          )
        }
      />
      <Tabs tabs={tabs} active={tab} base="/users" />
      {content}
    </>
  );
}
