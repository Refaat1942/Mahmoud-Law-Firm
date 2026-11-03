"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Bot, ListChecks, Loader2, RotateCcw, Send } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { ActionResult } from "@/lib/action";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Textarea } from "./ui/input";

type Msg = { role: "user" | "assistant"; content: string; actions?: { type: "task"; id: string; title: string }[]; error?: boolean };

const STORE = "assistant-chat";

/** Chat with the office assistant; the conversation lives in this browser tab only. */
export function AssistantChat({ ask, initial, prompts }: { ask: (v: unknown) => Promise<ActionResult>; initial?: string; prompts: string[] }) {
  const t = useTranslations("assistant");
  const tr = useTranslations();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  const sentInitial = useRef(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORE);
      if (saved) setMessages(JSON.parse(saved));
    } catch {
      /* private mode or blocked storage: start empty */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify(messages.slice(-40)));
    } catch {
      /* ignore */
    }
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const send = (content: string) => {
    const q = content.trim();
    if (!q || pending) return;
    const next: Msg[] = [...messages.filter((m) => !m.error), { role: "user", content: q }];
    setMessages(next);
    setText("");
    start(async () => {
      const res = await ask({ messages: next.map(({ role, content }) => ({ role, content })) });
      if (!res.ok) {
        setMessages((m) => [...m, { role: "assistant", content: tr(res.error), error: true }]);
        return;
      }
      const data = res.data as { reply: string; actions: Msg["actions"] };
      setMessages((m) => [...m, { role: "assistant", content: data.reply || t("empty"), actions: data.actions }]);
    });
  };

  useEffect(() => {
    if (initial && !sentInitial.current) {
      sentInitial.current = true;
      send(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  return (
    <div className="flex h-[calc(100vh-11rem)] min-h-[420px] flex-col rounded-xl border bg-card">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="mx-auto max-w-xl py-8 text-center">
            <Bot className="mx-auto mb-3 size-10 text-accent" />
            <p className="mb-4 text-sm text-muted-foreground">{t("intro")}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {prompts.map((p) => (
                <Button key={p} variant="outline" size="sm" onClick={() => send(p)}>
                  {p}
                </Button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-start" : "justify-end")}>
            <div
              className={cn(
                "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                m.role === "user" ? "bg-primary text-primary-foreground" : m.error ? "bg-destructive/10 text-destructive" : "bg-muted",
              )}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
              {m.actions?.map((a) => (
                <Link key={a.id} href={`/tasks/${a.id}`} className="mt-2 flex items-center gap-1 text-xs font-medium text-primary underline dark:text-accent">
                  <ListChecks className="size-3.5" /> {t("taskCreated", { title: a.title })}
                </Link>
              ))}
            </div>
          </div>
        ))}
        {pending && (
          <div className="flex justify-end">
            <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> {t("thinking")}
            </div>
          </div>
        )}
        <div ref={end} />
      </div>
      <form
        className="flex items-end gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        {messages.length > 0 && (
          <Button type="button" variant="ghost" size="icon" onClick={() => setMessages([])} aria-label={t("newChat")} title={t("newChat")}>
            <RotateCcw />
          </Button>
        )}
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(text);
            }
          }}
          placeholder={t("placeholder")}
          rows={2}
          className="min-h-0 flex-1 resize-none"
          maxLength={8000}
        />
        <Button type="submit" disabled={pending || !text.trim()} aria-label={t("send")}>
          <Send />
        </Button>
      </form>
    </div>
  );
}
