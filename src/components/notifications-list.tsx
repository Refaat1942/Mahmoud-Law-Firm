import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { ActionButton } from "./action-button";
import { DateText } from "./format";
import { Card } from "./ui/card";
import { markNotificationsRead } from "@/server/users/actions";

export async function NotificationsList({ userId }: { userId: string }) {
  const t = await getTranslations();
  const items = await prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 200 });
  const unread = items.some((n) => !n.readAt);
  return (
    <div className="space-y-3">
      {unread && (
        <ActionButton variant="outline" size="sm" action={markNotificationsRead}>
          {t("notifications.markAllRead")}
        </ActionButton>
      )}
      {items.length === 0 && <p className="py-10 text-center text-muted-foreground">{t("notifications.empty")}</p>}
      {items.map((n) => {
        const body = (
          <Card className={cn("p-4", !n.readAt && "border-accent/60 bg-accent/5")}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{n.title}</p>
                {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                <DateText value={n.createdAt} withTime />
              </span>
            </div>
          </Card>
        );
        return n.link ? (
          <Link key={n.id} href={n.link} className="block">
            {body}
          </Link>
        ) : (
          <div key={n.id}>{body}</div>
        );
      })}
    </div>
  );
}
