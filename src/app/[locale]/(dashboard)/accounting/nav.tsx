import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { key: "overview", href: "/accounting" },
  { key: "expenses", href: "/accounting/expenses" },
  { key: "journal", href: "/accounting/journal" },
  { key: "accounts", href: "/accounting/accounts" },
  { key: "banks", href: "/accounting/banks" },
  { key: "reports", href: "/accounting/reports" },
] as const;

export async function AccountingNav({ active }: { active: (typeof SECTIONS)[number]["key"] }) {
  const t = await getTranslations("accounting");
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
