"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action";
import { Button } from "@/components/ui/button";

export function PermissionMatrix({
  modules,
  actions,
  initial,
  save,
  readOnly,
}: {
  modules: string[];
  actions: string[];
  initial: string[];
  save: (payload: unknown) => Promise<ActionResult>;
  readOnly?: boolean;
}) {
  const t = useTranslations();
  const [selected, setSelected] = useState(new Set(initial));
  const [pending, start] = useTransition();

  const toggle = (key: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const toggleRow = (m: string) => {
    const keys = actions.map((a) => `${m}:${a}`);
    const allOn = keys.every((k) => selected.has(k));
    setSelected((s) => {
      const n = new Set(s);
      keys.forEach((k) => (allOn ? n.delete(k) : n.add(k)));
      return n;
    });
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="border-b px-3 py-2 text-start">{t("users.module")}</th>
              {actions.map((a) => (
                <th key={a} className="border-b px-3 py-2 text-center">
                  {t(`users.actions.${a}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map((m) => (
              <tr key={m} className="hover:bg-muted/40">
                <td className="border-b px-3 py-2">
                  <button type="button" className="font-medium hover:underline disabled:no-underline" onClick={() => toggleRow(m)} disabled={readOnly}>
                    {t(`users.modules.${m}`)}
                  </button>
                </td>
                {actions.map((a) => {
                  const key = `${m}:${a}`;
                  return (
                    <td key={a} className="border-b px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--primary)]"
                        checked={selected.has(key)}
                        disabled={readOnly}
                        onChange={() => toggle(key)}
                        aria-label={`${m} ${a}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await save({ permissions: [...selected] });
              if (res.ok) toast.success(t("common.saved"));
              else toast.error(t(res.error));
            })
          }
        >
          {pending ? t("common.saving") : t("common.save")}
        </Button>
      )}
    </div>
  );
}
