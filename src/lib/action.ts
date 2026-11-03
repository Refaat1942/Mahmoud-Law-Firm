import "server-only";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getCurrentUser, type CurrentUser } from "./session";
import { audit } from "./audit";
import type { Action, Module } from "./rbac";

export type ActionResult = { ok: true; id?: string; data?: unknown } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export class ActionError extends Error {}

type Ctx = { user: CurrentUser };

type Options<S extends z.ZodTypeAny> = {
  module: Module;
  perm: Action;
  schema?: S;
  /** Entity name written to the audit log. */
  entity: string;
  /** Allows portal (client) users; permission check is skipped and the handler must scope by user.clientId. */
  portal?: boolean;
};

/**
 * Wraps a server action with authentication, permission check, validation, audit log and cache revalidation.
 * The payload is always the last argument; earlier arguments come from `.bind(null, ...)`.
 */
export function defineAction<S extends z.ZodTypeAny, B extends unknown[] = []>(
  opts: Options<S>,
  handler: (input: z.infer<S>, ctx: Ctx, ...bound: B) => Promise<{ id?: string; data?: unknown; audit?: unknown } | void>,
) {
  return async (...args: [...B, unknown]): Promise<ActionResult> => {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "errors.unauthorized" };
    if (opts.portal) {
      if (!user.clientId) return { ok: false, error: "errors.forbidden" };
    } else if (user.clientId || !user.perms.has(`${opts.module}:${opts.perm}`)) {
      return { ok: false, error: "errors.forbidden" };
    }

    const raw = args[args.length - 1];
    // File uploads arrive as FormData; flatten it so the Zod schema sees plain fields (and File values).
    const payload = raw instanceof FormData ? Object.fromEntries(raw.entries()) : raw;
    const bound = args.slice(0, -1) as B;
    let input: z.infer<S> = payload as z.infer<S>;
    if (opts.schema) {
      const parsed = opts.schema.safeParse(payload ?? {});
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
        return { ok: false, error: "errors.validation", fieldErrors };
      }
      input = parsed.data;
    }

    try {
      const res = (await handler(input, { user }, ...bound)) ?? {};
      await audit({
        userId: user.id,
        action: `${opts.perm}`,
        entity: opts.entity,
        entityId: res.id ?? (typeof bound[0] === "string" ? (bound[0] as string) : null),
        data: res.audit ?? (opts.schema ? input : undefined),
      });
      revalidatePath("/", "layout");
      return { ok: true, id: res.id, data: res.data };
    } catch (e) {
      if (e instanceof ActionError) return { ok: false, error: e.message };
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === "P2002") return { ok: false, error: "errors.duplicate" };
        if (e.code === "P2003") return { ok: false, error: "errors.inUse" };
        if (e.code === "P2025") return { ok: false, error: "errors.notFound" };
      }
      console.error(e);
      return { ok: false, error: "errors.unexpected" };
    }
  };
}
