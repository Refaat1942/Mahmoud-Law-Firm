import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { key: "employees", href: "/hr" },
  { key: "attendance", href: "/hr/attendance" },
  { key: "leave", href: "/hr/leave" },
  { key: "payroll", href: "/hr/payroll" },
] as const;

export async function HrNav({ active }: { active: (typeof SECTIONS)[number]["key"] }) {
  const t = await getTranslations("hr");
  return (
    <div className="no-print mb-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b">
      {SECTIONS.map((s) => (
        <Link
          key={s.key}
          href={s.href}
          className={cn(
            "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm",
            s.key === active ? "border-accent font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t(`sections.${s.key}`)}
        </Link>
      ))}
    </div>
  );
}
