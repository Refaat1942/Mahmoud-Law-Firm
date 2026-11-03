"use client";

import { Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "./ui/button";

export function PrintButton() {
  const t = useTranslations("common");
  return (
    <Button type="button" variant="outline" onClick={() => window.print()}>
      <Printer /> {t("print")}
    </Button>
  );
}
