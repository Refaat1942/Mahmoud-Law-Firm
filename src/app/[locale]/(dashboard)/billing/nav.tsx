import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const SECTIONS = ["invoices", "quotes", "payments", "trust"] as const;

/** Section links shared by the billing pages. */
export async function BillingNav({ active }: { active: (typeof SECTIONS)[number] }) {
  const t = await getTranslations("billing");
  return (
    <div className="no-print mb-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b">
      {SECTIONS.map((key) => (
        <Link
          key={key}
          href={`/billing/${key}`}
          className={cn(
            "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm",
            key === active ? "border-accent font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t(`sections.${key}`)}
        </Link>
      ))}
    </div>
  );
}
