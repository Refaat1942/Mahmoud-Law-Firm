"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import type { ActionResult } from "@/lib/action";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type Result = { imported: number; skipped: number; errors: { line: number; error: string }[] };

/** Uploads a CSV to an import action and shows what was imported and which lines were rejected. */
export function CsvImport({ action }: { action: (v: unknown) => Promise<ActionResult> }) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Result | null>(null);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const res = await action(fd);
          if (!res.ok) {
            toast.error(t(res.error));
            return;
          }
          setResult(res.data as Result);
          router.refresh();
        });
      }}
    >
      <Input type="file" name="file" accept=".csv,text/csv" required className="cursor-pointer" />
      <Button type="submit" variant="outline" disabled={pending}>
        <Upload /> {pending ? t("common.saving") : t("courts.import")}
      </Button>
      {result && (
        <div className="rounded-lg bg-muted/50 p-3 text-sm">
          <p>{t("courts.importResult", { imported: result.imported, skipped: result.skipped, errors: result.errors.length })}</p>
          {result.errors.length > 0 && (
            <ul className="mt-2 list-disc ps-5 text-xs text-destructive">
              {result.errors.slice(0, 20).map((e) => (
                <li key={`${e.line}-${e.error}`}>{t("courts.importError", { line: e.line, error: t(`courts.csvErrors.${e.error}`) })}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
