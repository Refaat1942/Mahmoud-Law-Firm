import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/session";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await getCurrentUser();
  redirect({ href: !user ? "/login" : user.clientId ? "/portal" : "/dashboard", locale });
}
