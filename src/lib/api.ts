import "server-only";
import { routing } from "@/i18n/routing";
import type { Action, Module } from "./rbac";
import { can, getCurrentUser, type CurrentUser } from "./session";

export class HttpError extends Error {
  constructor(public status: number) {
    super(String(status));
  }
}

/** Authenticates an API request; staff need the given permission, portal users are rejected unless `portal` is set. */
export async function apiUser(module?: Module, action: Action = "view", opts: { portal?: boolean } = {}): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401);
  if (user.clientId) {
    if (!opts.portal) throw new HttpError(403);
    return user;
  }
  if (module && !can(user, module, action)) throw new HttpError(403);
  return user;
}

export function apiLocale(req: Request) {
  const l = new URL(req.url).searchParams.get("locale");
  return (routing.locales as readonly string[]).includes(l ?? "") ? (l as string) : routing.defaultLocale;
}

export function withErrors(handler: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return new Response(null, { status: e.status });
      console.error(e);
      return new Response(null, { status: 500 });
    }
  };
}
