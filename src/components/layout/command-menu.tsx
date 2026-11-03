"use client";

import { useEffect, useState, useTransition } from "react";
import { Command } from "cmdk";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { globalSearch, type SearchHit } from "@/server/search/actions";

export function CommandMenu() {
  const t = useTranslations("search");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [pending, start] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([]);
      return;
    }
    const id = setTimeout(() => start(async () => setHits(await globalSearch(query))), 250);
    return () => clearTimeout(id);
  }, [query]);

  const groups = [...new Set(hits.map((h) => h.group))];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-sm items-center gap-2 rounded-lg border bg-muted/50 px-3 text-sm text-muted-foreground hover:bg-muted"
      >
        <Search className="size-4" />
        <span className="flex-1 text-start">{t("placeholder")}</span>
        <kbd className="rounded border bg-card px-1.5 text-[10px]" dir="ltr">
          Ctrl K
        </kbd>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]" onClick={() => setOpen(false)}>
          <Command
            shouldFilter={false}
            className="w-full max-w-xl overflow-hidden rounded-xl border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b px-3">
              <Search className="size-4 text-muted-foreground" />
              <Command.Input autoFocus value={query} onValueChange={setQuery} placeholder={t("placeholder")} className="h-12 w-full bg-transparent text-sm outline-none" />
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-2">
              {query.trim().length >= 2 && !pending && hits.length === 0 && (
                <Command.Empty className="p-6 text-center text-sm text-muted-foreground">{t("empty")}</Command.Empty>
              )}
              {pending && <div className="p-4 text-center text-sm text-muted-foreground">{t("searching")}</div>}
              {groups.map((g) => (
                <Command.Group key={g} heading={t(`groups.${g}`)} className="mb-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted-foreground">
                  {hits
                    .filter((h) => h.group === g)
                    .map((h) => (
                      <Command.Item
                        key={h.href}
                        value={h.href}
                        onSelect={() => {
                          setOpen(false);
                          setQuery("");
                          router.push(h.href);
                        }}
                        className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm data-[selected=true]:bg-muted"
                      >
                        <span className="truncate">{h.title}</span>
                        {h.subtitle && <span className="truncate text-xs text-muted-foreground">{h.subtitle}</span>}
                      </Command.Item>
                    ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </div>
      )}
    </>
  );
}
