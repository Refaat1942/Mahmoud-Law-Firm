"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useSearchParams } from "next/navigation";
import { Bell, Languages, LogOut, Moon, Sun, UserRound } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { CommandMenu } from "./command-menu";

export function Topbar({
  userName,
  roleName,
  unread,
  logout,
  profileHref = "/profile",
  notificationsHref = "/notifications",
  search = true,
}: {
  userName: string;
  roleName: string;
  unread: number;
  logout: () => Promise<void>;
  profileHref?: string;
  notificationsHref?: string;
  search?: boolean;
}) {
  const t = useTranslations("topbar");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const [pending, start] = useTransition();

  const switchLocale = () => {
    const qs = searchParams.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { locale: locale === "ar" ? "en" : "ar" });
  };

  return (
    <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-card/95 px-4 backdrop-blur">
      {search ? <CommandMenu /> : <div />}
      <div className="ms-auto flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={switchLocale} aria-label={t("language")}>
          <Languages /> {locale === "ar" ? "English" : "العربية"}
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={t("theme")}>
          <Sun className="hidden dark:block" />
          <Moon className="dark:hidden" />
        </Button>
        <Link href={notificationsHref} className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted" aria-label={t("notifications")}>
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -end-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Link>
        <Link href={profileHref} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-muted">
          <UserRound className="size-4" />
          <span className="hidden text-start leading-tight sm:block">
            <span className="block text-sm font-medium">{userName}</span>
            <span className="block text-xs text-muted-foreground">{roleName}</span>
          </span>
        </Link>
        <Button variant="ghost" size="icon" disabled={pending} onClick={() => start(() => logout())} aria-label={t("logout")}>
          <LogOut className="rtl:rotate-180" />
        </Button>
      </div>
    </header>
  );
}
