import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verify } from "@node-rs/argon2";
import { authenticator } from "otplib";
import { prisma } from "./prisma";
import { audit } from "./audit";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

class LoginError extends CredentialsSignin {
  constructor(code: string) {
    super();
    this.code = code;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/ar/login" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: { email: {}, password: {}, otp: {} },
      authorize: async (raw) => {
        const email = String(raw?.email ?? "").trim().toLowerCase();
        const password = String(raw?.password ?? "");
        const otp = String(raw?.otp ?? "").trim();
        if (!email || !password) throw new LoginError("invalid");

        const user = await prisma.user.findFirst({ where: { email, deletedAt: null } });
        if (!user || !user.isActive) throw new LoginError("invalid");
        if (user.lockedUntil && user.lockedUntil > new Date()) throw new LoginError("locked");

        const ok = await verify(user.passwordHash, password);
        if (!ok) {
          const failed = user.failedLogins + 1;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLogins: failed >= MAX_FAILED ? 0 : failed,
              lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
            },
          });
          await audit({ userId: user.id, action: "login_failed", entity: "User", entityId: user.id });
          throw new LoginError(failed >= MAX_FAILED ? "locked" : "invalid");
        }

        if (user.totpEnabled && user.totpSecret) {
          if (!otp) throw new LoginError("otp_required");
          if (!authenticator.verify({ token: otp, secret: user.totpSecret })) throw new LoginError("otp_invalid");
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
        });
        await audit({ userId: user.id, action: "login", entity: "User", entityId: user.id });
        return { id: user.id, email: user.email, name: user.nameEn };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.uid && session.user) session.user.id = token.uid as string;
      return session;
    },
  },
});
