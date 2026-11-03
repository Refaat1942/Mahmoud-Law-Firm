"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PlugZap } from "lucide-react";
import type { ActionResult } from "@/lib/action";
import { Button } from "./ui/button";

/** Calls the provider's model list with the stored key and shows the result. */
export function AiTestButton({ action }: { action: (v: unknown) => Promise<ActionResult> }) {
  const t = useTranslations();
  const [pending, start] = useTransition();
  const [models, setModels] = useState<string[] | null>(null);
  const [hasModel, setHasModel] = useState(true);
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await action({});
            if (!res.ok) {
              setModels(null);
              toast.error(t(res.error));
              return;
            }
            const data = res.data as { models: string[]; hasModel: boolean };
            setModels(data.models);
            setHasModel(data.hasModel);
            toast.success(t("assistant.connected"));
          })
        }
      >
        <PlugZap /> {pending ? t("assistant.testing") : t("assistant.test")}
      </Button>
      {models && (
        <div className="text-xs">
          {!hasModel && <p className="mb-1 text-destructive">{t("assistant.modelMissing")}</p>}
          <p className="mb-1 text-muted-foreground">{t("assistant.availableModels", { count: models.length })}</p>
          <div className="max-h-40 overflow-auto whitespace-pre-line rounded border p-2 font-mono" dir="ltr">
            {models.join("\n") || "—"}
          </div>
        </div>
      )}
    </div>
  );
}
