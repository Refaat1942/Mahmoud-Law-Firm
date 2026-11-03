"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Briefcase,
  CalendarDays,
  ChartColumn,
  ChevronsLeft,
  FolderOpen,
  Gavel,
  IdCard,
  Landmark,
  LayoutDashboard,
  ListChecks,
  Receipt,
  Scale,
  Settings,
  ShieldCheck,
  Timer,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  Briefcase,
  Gavel,
  CalendarDays,
  ListChecks,
  FolderOpen,
  Timer,
  Receipt,
  Landmark,
  IdCard,
  ChartColumn,
  ShieldCheck,
  Settings,
};

export function Sidebar({ items, officeName }: { items: { key: string; href: string; icon: string }[]; officeName: string }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("sidebar-collapsed") === "1");
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      localStorage.setItem("sidebar-collapsed", c ? "0" : "1");
      return !c;
    });
  };

  return (
    <aside
      className={cn(
        "no-print sticky top-0 flex h-screen shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b border-white/10 px-4">
        <Scale className="size-6 shrink-0 text-sidebar-active" />
        {!collapsed && <span className="truncate font-bold text-white">{officeName}</span>}
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {items.map((item) => {
          const Icon = ICONS[item.icon] ?? LayoutDashboard;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.key}
              href={item.href}
              title={collapsed ? t(item.key) : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active ? "bg-white/10 font-semibold text-sidebar-active" : "hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">{t(item.key)}</span>}
            </Link>
          );
        })}
      </nav>
      <button onClick={toggle} className="flex h-10 items-center justify-center border-t border-white/10 hover:bg-white/5" aria-label={t("collapse")}>
        <ChevronsLeft className={cn("size-4 transition-transform", collapsed ? "ltr:rotate-180" : "rtl:rotate-180")} />
      </button>
    </aside>
  );
}
