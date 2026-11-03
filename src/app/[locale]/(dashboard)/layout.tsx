import { Suspense } from "react";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { can, requireStaff } from "@/lib/session";
import { getOffice } from "@/lib/settings";
import { NAV_ITEMS } from "@/components/layout/nav";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { logout } from "@/server/auth/actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const locale = await getLocale();
  const [office, unread] = await Promise.all([getOffice(), prisma.notification.count({ where: { userId: user.id, readAt: null } })]);
  const items = NAV_ITEMS.filter((i) => can(user, i.module)).map(({ key, href, icon }) => ({ key, href, icon }));

  return (
    <div className="flex min-h-screen">
      <Sidebar items={items} officeName={locale === "en" ? office.nameEn : office.nameAr} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense>
          <Topbar
            userName={locale === "en" ? user.nameEn : user.nameAr}
            roleName={locale === "en" ? user.roleNameEn : user.roleNameAr}
            unread={unread}
            logout={logout}
          />
        </Suspense>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
