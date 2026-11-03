import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { localized } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { DateText } from "./format";

/** Conversation between a client and the office, oldest first; `side` decides which messages are "mine". */
export async function MessageThread({ clientId, side }: { clientId: string; side: "client" | "office" }) {
  const t = await getTranslations("portal");
  const locale = await getLocale();
  const messages = await prisma.message.findMany({ where: { clientId }, include: { fromUser: true, matter: true }, orderBy: { createdAt: "asc" }, take: 500 });
  if (!messages.length) return <p className="text-sm text-muted-foreground">{t("noMessages")}</p>;
  return (
    <ul className="space-y-3">
      {messages.map((m) => {
        const mine = (side === "client") === m.fromClient;
        return (
          <li key={m.id} className={cn("flex", mine ? "justify-start" : "justify-end")}>
            <div className={cn("max-w-[80%] rounded-xl p-3 text-sm", mine ? "bg-primary text-primary-foreground" : "bg-muted")}>
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs opacity-80">
                <span className="font-semibold">{m.fromClient ? localized(m.fromUser, locale) : `${localized(m.fromUser, locale)} · ${t("office")}`}</span>
                {m.matter && <span>· {m.matter.fileNo}</span>}
                <DateText value={m.createdAt} withTime />
              </div>
              <p className="whitespace-pre-wrap">{m.body}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
