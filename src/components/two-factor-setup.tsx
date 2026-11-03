"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { confirmTotp, disableTotp, startTotpSetup } from "@/server/users/actions";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function TwoFactorSetup({ enabled }: { enabled: boolean }) {
  const t = useTranslations();
  const router = useRouter();
  const [setup, setSetup] = useState<{ qr: string; secret: string } | null>(null);
  const [token, setToken] = useState("");
  const [pending, start] = useTransition();

  if (enabled) {
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-2 text-sm text-success">
          <ShieldCheck className="size-4" /> {t("profile.twoFactorOn")}
        </p>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              if (!window.confirm(t("common.confirm"))) return;
              await disableTotp();
              toast.success(t("common.done"));
              router.refresh();
            })
          }
        >
          {t("profile.disableTwoFactor")}
        </Button>
      </div>
    );
  }

  if (!setup) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("profile.twoFactorIntro")}</p>
        <Button disabled={pending} onClick={() => start(async () => setSetup(await startTotpSetup()))}>
          {t("profile.enableTwoFactor")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm">{t("profile.scanQr")}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={setup.qr} alt="QR" className="size-44 rounded border bg-white p-2" />
      <p className="text-xs text-muted-foreground" dir="ltr">
        {setup.secret}
      </p>
      <div className="flex gap-2">
        <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="123456" dir="ltr" maxLength={6} inputMode="numeric" className="max-w-36" />
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await confirmTotp({ token });
              if (!res.ok) {
                toast.error(t(res.error));
                return;
              }
              toast.success(t("profile.twoFactorOn"));
              setSetup(null);
              router.refresh();
            })
          }
        >
          {t("profile.verify")}
        </Button>
      </div>
    </div>
  );
}
