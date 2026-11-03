"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import type { ActionResult } from "@/lib/action";
import { Button, type ButtonProps } from "./ui/button";

/** Runs a server action from a button, with optional confirmation and redirect. */
export function ActionButton({
  action,
  payload,
  confirm,
  redirectTo,
  children,
  successMessage,
  ...props
}: Omit<ButtonProps, "onClick"> & {
  action: (payload: unknown) => Promise<ActionResult>;
  payload?: unknown;
  confirm?: string;
  redirectTo?: string;
  successMessage?: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      disabled={pending || props.disabled}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => {
          const res = await action(payload ?? {});
          if (!res.ok) {
            toast.error(t(res.error));
            return;
          }
          toast.success(successMessage ?? t("common.done"));
          if (redirectTo) router.push(redirectTo.replace(":id", res.id ?? ""));
          else router.refresh();
        });
      }}
      {...props}
    >
      {children}
    </Button>
  );
}
