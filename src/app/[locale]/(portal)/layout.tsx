import { Suspense } from "react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getOffice } from "@/lib/settings";
import { localized } from "@/lib/utils";
import { Link, redirect } from "@/i18n/navigation";
import { Topbar } from "@/components/layout/topbar";
import { logout } from "@/server/auth/actions";

/** Client portal shell: only client (portal) users; staff are sent to the dashboard. */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const locale = await getLocale();
  if (!user.clientId) redirect({ href: "/dashboard", locale });
  const t = await getTranslations("portal");
  const [office, client, unread] = await Promise.all([
    getOffice(),
    prisma.client.findUniqueOrThrow({ where: { id: user.clientId! } }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return (
    <div className="min-h-screen">
      <div className="flex items-center gap-3 bg-sidebar px-4 py-2 text-white">
        <Image src="/logo-mark.png" alt="" width={36} height={35} className="size-9" />
        <Link href="/portal" className="font-bold">
          {locale === "en" ? office.nameEn : office.nameAr}
        </Link>
        <span className="text-sm opacity-70">· {t("title")}</span>
      </div>
      <Suspense>
        <Topbar
          userName={locale === "en" ? user.nameEn : user.nameAr}
          roleName={localized(client, locale)}
          unread={unread}
          logout={logout}
          profileHref="/portal"
          notificationsHref="/portal/messages"
          search={false}
        />
      </Suspense>
      <main className="mx-auto max-w-6xl p-4 md:p-6">{children}</main>
    </div>
  );
}
