import { getTranslations } from "next-intl/server";
import { Scale } from "lucide-react";
import { getOffice } from "@/lib/settings";
import { LoginForm } from "./login-form";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("login") };
}

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("auth");
  const office = await getOffice();
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#13203b] to-[#1b2a4a] p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="rounded-full bg-accent/15 p-3">
            <Scale className="size-8 text-accent" />
          </div>
          <h1 className="text-xl font-bold">{locale === "en" ? office.nameEn : office.nameAr}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
