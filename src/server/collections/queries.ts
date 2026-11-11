import "server-only";
import type { Prisma } from "@prisma/client";
import type { CurrentUser } from "@/lib/session";
import { invoiceScope } from "../billing/queries";

/** Collection notes a user may see: all for scope-all roles, otherwise notes on clients with an invoice in their scope. */
export function collectionScope(user: CurrentUser): Prisma.CollectionNoteWhereInput {
  if (user.scopeAll) return {};
  return { client: { invoices: { some: invoiceScope(user) } } };
}

/** Invoices still owed: issued or part-paid within the user's scope. */
export function openInvoiceWhere(user: CurrentUser, clientId?: string): Prisma.InvoiceWhereInput {
  return { AND: [invoiceScope(user), { status: { in: ["ISSUED", "PARTIALLY_PAID"] } }, clientId ? { clientId } : {}] };
}
