"use server";

import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { can, getCurrentUser, matterScope } from "@/lib/session";
import { localized, localizedTitle } from "@/lib/utils";
import { invoiceScope } from "../billing/queries";
import { documentScope } from "../documents/queries";
import { taskScope } from "../tasks/queries";

export type SearchHit = { group: "clients" | "matters" | "documents" | "invoices" | "tasks" | "employees"; title: string; subtitle?: string; href: string };

export async function globalSearch(query: string): Promise<SearchHit[]> {
  const user = await getCurrentUser();
  const q = query.trim();
  if (!user || user.clientId || q.length < 2) return [];
  const locale = await getLocale();
  const like = { contains: q, mode: "insensitive" as const };
  const hits: SearchHit[] = [];

  const [clients, matters, documents, invoices, tasks, employees] = await Promise.all([
    can(user, "clients")
      ? prisma.client.findMany({
          where: { deletedAt: null, OR: [{ nameAr: like }, { nameEn: like }, { code: like }, { emiratesId: like }, { phone: like }, { mobile: like }, { altPhone: like }, { email: like }] },
          take: 6,
        })
      : [],
    can(user, "matters")
      ? prisma.matter.findMany({
          where: {
            AND: [
              matterScope(user),
              { OR: [{ titleAr: like }, { titleEn: like }, { fileNo: like }, { courtCaseNo: like }, { parties: { some: { party: { OR: [{ nameAr: like }, { nameEn: like }] } } } }] },
            ],
          },
          include: { client: true },
          take: 6,
        })
      : [],
    can(user, "documents")
      ? prisma.document.findMany({ where: { AND: [documentScope(user), { OR: [{ name: like }, { tags: { has: q } }] }] }, take: 6 })
      : [],
    can(user, "billing") ? prisma.invoice.findMany({ where: { AND: [invoiceScope(user), { number: like }] }, include: { client: true }, take: 6 }) : [],
    can(user, "tasks") ? prisma.task.findMany({ where: { AND: [taskScope(user), { title: like }] }, take: 6 }) : [],
    can(user, "hr") ? prisma.employee.findMany({ where: { deletedAt: null, OR: [{ nameAr: like }, { nameEn: like }, { code: like }] }, take: 6 }) : [],
  ]);

  for (const c of clients) hits.push({ group: "clients", title: localized(c, locale), subtitle: c.code, href: `/clients/${c.id}` });
  for (const m of matters)
    hits.push({ group: "matters", title: localizedTitle(m, locale), subtitle: `${m.fileNo} · ${localized(m.client, locale)}`, href: `/cases/${m.id}` });
  for (const d of documents) hits.push({ group: "documents", title: d.name, subtitle: d.folder, href: `/documents/${d.id}` });
  for (const i of invoices) hits.push({ group: "invoices", title: i.number, subtitle: localized(i.client, locale), href: `/billing/invoices/${i.id}` });
  for (const t of tasks) hits.push({ group: "tasks", title: t.title, href: `/tasks/${t.id}` });
  for (const e of employees) hits.push({ group: "employees", title: localized(e, locale), subtitle: e.code, href: `/hr/employees/${e.id}` });
  return hits;
}
