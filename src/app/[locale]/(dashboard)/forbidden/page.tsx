import { getTranslations } from "next-intl/server";
import { ShieldAlert } from "lucide-react";

export default async function Forbidden() {
  const t = await getTranslations("errors");
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <ShieldAlert className="size-12 text-destructive" />
      <h1 className="text-xl font-bold">{t("forbidden")}</h1>
      <p className="text-muted-foreground">{t("forbiddenHint")}</p>
    </div>
  );
}
