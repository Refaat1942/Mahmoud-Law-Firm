import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Section({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      {(title || actions) && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {actions && <div className="flex gap-2">{actions}</div>}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function DetailList({ items, columns = 3 }: { items: { label: ReactNode; value: ReactNode }[]; columns?: 2 | 3 | 4 }) {
  const cols = { 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4" }[columns];
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-3", cols)}>
      {items.map((it, i) => (
        <div key={i}>
          <dt className="text-xs text-muted-foreground">{it.label}</dt>
          <dd className="mt-0.5 text-sm font-medium break-words">{it.value || <span className="text-muted-foreground">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Tabs({ tabs, active, base }: { tabs: { key: string; label: ReactNode }[]; active: string; base: string }) {
  return (
    <div className="no-print mb-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={`${base}?tab=${tab.key}`}
          scroll={false}
          className={cn(
            "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm",
            tab.key === active ? "border-accent font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

export function StatCard({ label, value, hint, icon, href }: { label: ReactNode; value: ReactNode; hint?: ReactNode; icon?: ReactNode; href?: string }) {
  const body = (
    <Card className="h-full p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {icon && <div className="rounded-lg bg-accent/15 p-2 text-accent">{icon}</div>}
      </div>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
