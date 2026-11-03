"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import type { ActionResult } from "@/lib/action";
import { Button } from "./ui/button";
import { Input, Label, Select } from "./ui/input";
import { useFmt } from "./format";

type Line = { accountId: string; debit: string; credit: string; memo: string };
const blank = (): Line => ({ accountId: "", debit: "", credit: "", memo: "" });
const cents = (v: string) => Math.round((Number(v) || 0) * 100);

/** Manual journal entry with any number of lines; submit is enabled only when debits equal credits. */
export function JournalForm({ accounts, action, today }: { accounts: { value: string; label: string }[]; action: (v: unknown) => Promise<ActionResult>; today: string }) {
  const t = useTranslations();
  const fmt = useFmt();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<Line[]>([blank(), blank()]);
  const totals = useMemo(() => ({ debit: lines.reduce((a, l) => a + cents(l.debit), 0), credit: lines.reduce((a, l) => a + cents(l.credit), 0) }), [lines]);
  const balanced = totals.debit > 0 && totals.debit === totals.credit;
  const set = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const used = lines.filter((l) => l.accountId && (cents(l.debit) || cents(l.credit)));
    start(async () => {
      const res = await action({
        date,
        description,
        lines: used.map((l) => ({ accountId: l.accountId, debit: l.debit || undefined, credit: l.credit || undefined, memo: l.memo || undefined })),
      });
      if (!res.ok) {
        toast.error(t(res.error));
        return;
      }
      toast.success(t("common.saved"));
      router.push(`/accounting/journal/${res.id}`);
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="j-date">{t("f.date")}</Label>
          <Input id="j-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="j-desc">{t("f.description")}</Label>
          <Input id="j-desc" value={description} onChange={(e) => setDescription(e.target.value)} required maxLength={500} />
        </div>
      </div>
      <div className="space-y-2">
        <div className="hidden grid-cols-12 gap-2 text-xs text-muted-foreground md:grid">
          <span className="col-span-5">{t("f.account")}</span>
          <span className="col-span-2">{t("f.debit")}</span>
          <span className="col-span-2">{t("f.credit")}</span>
          <span className="col-span-2">{t("f.memo")}</span>
        </div>
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <Select className="col-span-12 md:col-span-5" value={l.accountId} onChange={(e) => set(i, { accountId: e.target.value })} aria-label={t("f.account")}>
              <option value="">{t("common.select")}</option>
              {accounts.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </Select>
            <Input className="col-span-4 md:col-span-2" type="number" step="0.01" min="0" dir="ltr" value={l.debit} onChange={(e) => set(i, { debit: e.target.value, credit: e.target.value ? "" : l.credit })} aria-label={t("f.debit")} />
            <Input className="col-span-4 md:col-span-2" type="number" step="0.01" min="0" dir="ltr" value={l.credit} onChange={(e) => set(i, { credit: e.target.value, debit: e.target.value ? "" : l.debit })} aria-label={t("f.credit")} />
            <Input className="col-span-3 md:col-span-2" value={l.memo} onChange={(e) => set(i, { memo: e.target.value })} aria-label={t("f.memo")} />
            <Button type="button" variant="ghost" size="icon" className="col-span-1" onClick={() => setLines((ls) => (ls.length > 2 ? ls.filter((_, j) => j !== i) : ls))} aria-label={t("common.delete")}>
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, blank()])}>
          <Plus /> {t("accounting.addLine")}
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm">
        <span>
          {t("f.debit")}: <b className="tabular-nums">{fmt.money(totals.debit / 100)}</b> · {t("f.credit")}: <b className="tabular-nums">{fmt.money(totals.credit / 100)}</b>
          {!balanced && totals.debit + totals.credit > 0 && (
            <span className="ms-3 text-destructive">{t("accounting.difference", { amount: fmt.money(Math.abs(totals.debit - totals.credit) / 100) })}</span>
          )}
        </span>
        <Button type="submit" disabled={!balanced || !description || pending}>
          {pending ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </form>
  );
}
