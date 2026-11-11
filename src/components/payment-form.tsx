"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Wand2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import type { ActionResult } from "@/lib/action";
import { Button } from "./ui/button";
import { Input, Label, Select, Textarea } from "./ui/input";
import { useFmt } from "./format";

type OpenInvoice = { id: string; number: string; due: string; currency: string; issueDate: string };
type Option = { value: string; label: string };
const cents = (v: string | number) => Math.round((Number(v) || 0) * 100);

/**
 * Receipt entry with allocation across the client's open invoices. In "allocate" mode only the
 * allocation table is shown, to place the on-account part of an existing receipt.
 */
export function PaymentForm({
  mode,
  action,
  clientId,
  invoices,
  banks = [],
  methods = [],
  defaults,
  available,
  redirectTo,
}: {
  mode: "create" | "allocate";
  action: (v: unknown) => Promise<ActionResult>;
  clientId: string;
  invoices: OpenInvoice[];
  banks?: Option[];
  methods?: Option[];
  defaults?: { amount?: string; invoiceId?: string; date: string; bankAccountId?: string };
  /** Allocate mode: the receipt's unallocated amount. */
  available?: string;
  redirectTo: string;
}) {
  const t = useTranslations();
  const fmt = useFmt();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    date: defaults?.date ?? "",
    amount: defaults?.amount ?? "",
    method: "TRANSFER",
    bankAccountId: defaults?.bankAccountId ?? banks[0]?.value ?? "",
    chequeNo: "",
    chequeDueDate: "",
    reference: "",
    notes: "",
  });
  const [alloc, setAlloc] = useState<Record<string, string>>(() =>
    defaults?.invoiceId ? { [defaults.invoiceId]: defaults.amount ?? "" } : {},
  );
  const total = mode === "create" ? form.amount : (available ?? "0");
  const allocated = useMemo(() => Object.values(alloc).reduce((a, v) => a + cents(v), 0), [alloc]);
  const left = cents(total) - allocated;

  const auto = () => {
    let rest = cents(total);
    const next: Record<string, string> = {};
    for (const inv of invoices) {
      if (rest <= 0) break;
      const take = Math.min(rest, cents(inv.due));
      if (take > 0) next[inv.id] = (take / 100).toFixed(2);
      rest -= take;
    }
    setAlloc(next);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const allocations = Object.entries(alloc)
      .filter(([, v]) => cents(v) > 0)
      .map(([invoiceId, amount]) => ({ invoiceId, amount }));
    if (left < 0) {
      toast.error(t("billing.allocationExceeds"));
      return;
    }
    start(async () => {
      const payload =
        mode === "create"
          ? { clientId, ...form, chequeNo: form.method === "CHEQUE" ? form.chequeNo : "", chequeDueDate: form.method === "CHEQUE" ? form.chequeDueDate : "", allocations }
          : { allocations };
      const res = await action(payload);
      if (!res.ok) {
        toast.error(t(res.error));
        return;
      }
      toast.success(t("common.saved"));
      router.push(redirectTo);
    });
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form onSubmit={submit} className="space-y-5">
      {mode === "create" && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="p-date">{t("f.date")}</Label>
            <Input id="p-date" type="date" value={form.date} onChange={set("date")} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-amount">{t("f.amount")}</Label>
            <Input id="p-amount" type="number" step="0.01" min="0.01" dir="ltr" value={form.amount} onChange={set("amount")} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-method">{t("f.method")}</Label>
            <Select id="p-method" value={form.method} onChange={set("method")}>
              {methods.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-bank">{t("f.bankAccount")}</Label>
            <Select id="p-bank" value={form.bankAccountId} onChange={set("bankAccountId")} required>
              {banks.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </Select>
          </div>
          {form.method === "CHEQUE" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="p-cheque">{t("f.chequeNo")}</Label>
                <Input id="p-cheque" dir="ltr" value={form.chequeNo} onChange={set("chequeNo")} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-chequeDate">{t("f.chequeDate")}</Label>
                <Input id="p-chequeDate" type="date" value={form.chequeDueDate} onChange={set("chequeDueDate")} />
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="p-ref">{t("f.reference")}</Label>
            <Input id="p-ref" dir="ltr" value={form.reference} onChange={set("reference")} />
          </div>
          <div className="space-y-1.5 md:col-span-3">
            <Label htmlFor="p-notes">{t("f.notes")}</Label>
            <Textarea id="p-notes" rows={2} value={form.notes} onChange={set("notes")} />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{t("billing.allocation")}</h3>
          {invoices.length > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={auto} disabled={cents(total) <= 0}>
              <Wand2 /> {t("billing.autoAllocate")}
            </Button>
          )}
        </div>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("billing.noOpenInvoices")}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-start">{t("f.invoice")}</th>
                  <th className="px-3 py-2 text-start">{t("f.issueDate")}</th>
                  <th className="px-3 py-2 text-start">{t("billing.balance")}</th>
                  <th className="px-3 py-2 text-start">{t("billing.allocate")}</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{inv.number}</td>
                    <td className="px-3 py-2">{fmt.date(inv.issueDate)}</td>
                    <td className="px-3 py-2 tabular-nums">{fmt.money(inv.due, inv.currency)}</td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max={inv.due}
                        dir="ltr"
                        className="w-36"
                        aria-label={`${t("billing.allocate")} ${inv.number}`}
                        value={alloc[inv.id] ?? ""}
                        onChange={(e) => setAlloc((a) => ({ ...a, [inv.id]: e.target.value }))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className={left < 0 ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
          {t("billing.allocated")}: <b className="tabular-nums">{fmt.money(allocated / 100)}</b> · {t("billing.onAccountLeft")}:{" "}
          <b className="tabular-nums">{fmt.money(left / 100)}</b>
        </p>
      </div>

      <Button type="submit" disabled={pending || (mode === "allocate" && allocated === 0)}>
        {pending ? t("common.saving") : t("common.save")}
      </Button>
    </form>
  );
}
