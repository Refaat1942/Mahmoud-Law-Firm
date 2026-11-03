"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { login } from "@/server/auth/actions";

export function LoginForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [needOtp, setNeedOtp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          const res = await login({
            email: String(fd.get("email") ?? ""),
            password: String(fd.get("password") ?? ""),
            otp: String(fd.get("otp") ?? ""),
          });
          if (res.ok) {
            // Full navigation so the new session cookie is used by the server layout.
            window.location.href = `/${locale}${res.to}`;
            return;
          }
          if (res.code === "otp_required") setNeedOtp(true);
          setError(res.code ?? "invalid");
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" name="email" type="email" dir="ltr" autoComplete="username" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">{t("password")}</Label>
        <Input id="password" name="password" type="password" dir="ltr" autoComplete="current-password" required />
      </div>
      {needOtp && (
        <div className="space-y-1.5">
          <Label htmlFor="otp">{t("otp")}</Label>
          <Input id="otp" name="otp" inputMode="numeric" dir="ltr" autoComplete="one-time-code" maxLength={6} autoFocus />
        </div>
      )}
      {error && <p className="text-sm text-destructive">{t(`errors.${error}`)}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t("signingIn") : t("signIn")}
      </Button>
    </form>
  );
}
