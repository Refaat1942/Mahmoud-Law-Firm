import { getTranslations } from "next-intl/server";
import { Settings } from "lucide-react";
import { can, requirePermission } from "@/lib/session";
import { decryptSecret } from "@/lib/crypto";
import { aiReady } from "@/lib/ai/providers";
import { getAiSettings } from "@/lib/settings";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { AssistantChat } from "@/components/assistant-chat";
import { PageHeader, Section } from "@/components/page";
import { askAssistant } from "@/server/ai/actions";

const PROMPTS = ["planDay", "week", "overdue", "remind"] as const;

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requirePermission("dashboard");
  const t = await getTranslations("assistant");
  const settings = await getAiSettings();
  const ready = aiReady(settings, decryptSecret(settings.apiKeyEnc));
  const q = (await searchParams).q;
  const initial = q === "plan" ? t("prompts.planDay") : undefined;

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {ready ? (
        <AssistantChat ask={askAssistant} initial={initial} prompts={PROMPTS.map((p) => t(`prompts.${p}`))} />
      ) : (
        <Section>
          <p className="mb-3 text-sm">{t("notConfigured")}</p>
          {can(user, "settings", "update") ? (
            <Link href="/settings?tab=ai" className={buttonVariants()}>
              <Settings /> {t("configure")}
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">{t("askAdmin")}</p>
          )}
        </Section>
      )}
      <p className="mt-3 text-xs text-muted-foreground">{t("privacy")}</p>
    </>
  );
}
