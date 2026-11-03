import type { Module } from "@/lib/rbac";

export type NavItem = { key: string; href: string; icon: string; module: Module };

// Only modules whose pages exist. Add hr, reports and settings back here as each
// phase ships its routes.
export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", href: "/dashboard", icon: "LayoutDashboard", module: "dashboard" },
  { key: "clients", href: "/clients", icon: "Users", module: "clients" },
  { key: "cases", href: "/cases", icon: "Briefcase", module: "matters" },
  { key: "hearings", href: "/hearings", icon: "Gavel", module: "hearings" },
  { key: "calendar", href: "/calendar", icon: "CalendarDays", module: "hearings" },
  { key: "tasks", href: "/tasks", icon: "ListChecks", module: "tasks" },
  { key: "documents", href: "/documents", icon: "FolderOpen", module: "documents" },
  { key: "time", href: "/time", icon: "Timer", module: "time" },
  { key: "billing", href: "/billing", icon: "Receipt", module: "billing" },
  { key: "accounting", href: "/accounting", icon: "Landmark", module: "accounting" },
  { key: "users", href: "/users", icon: "ShieldCheck", module: "users" },
];
