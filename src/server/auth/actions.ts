"use server";

import { AuthError } from "next-auth";
import { getLocale } from "next-intl/server";
import { signIn, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function login(input: { email: string; password: string; otp?: string }): Promise<{ ok: boolean; code?: string; to?: string }> {
  try {
    await signIn("credentials", { ...input, redirect: false });
  } catch (e) {
    if (e instanceof AuthError) {
      const code = (e as AuthError & { code?: string }).code ?? "invalid";
      return { ok: false, code: code === "credentials" ? "invalid" : code };
    }
    throw e;
  }
  const user = await prisma.user.findUnique({ where: { email: input.email.trim().toLowerCase() } });
  return { ok: true, to: user?.clientId ? "/portal" : "/dashboard" };
}

export async function logout() {
  const locale = await getLocale();
  await signOut({ redirectTo: `/${locale}/login` });
}
