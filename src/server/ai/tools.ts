import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { can, matterScope, type CurrentUser } from "@/lib/session";
import { agendaFor } from "@/lib/ai/agenda";
import type { ToolSpec } from "@/lib/ai/client";
import { balanceDue } from "@/lib/billing";
import { computeDueDate, isoDate } from "@/lib/deadlines";
import { getDeadlinePresets } from "@/lib/settings";
import { conflictCheck } from "../clients/queries";

/** What the assistant did that the user should see (links in the chat). */
export type AssistantAction = { type: "task"; id: string; title: string };

const spec = (name: string, description: string, properties: Record<string, unknown>, required: string[] = []): ToolSpec => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required, additionalProperties: false } },
});

/** Tools offered to the model, limited to what the user may see or do. */
export function toolsFor(user: CurrentUser): ToolSpec[] {
  const tools: ToolSpec[] = [
    spec("get_agenda", "The user's upcoming hearings, open legal deadlines and their own open tasks for the next N days (default 7).", {
      days: { type: "integer", minimum: 1, maximum: 31 },
    }),
  ];
  if (can(user, "matters") || can(user, "clients"))
    tools.push(spec("search", "Find clients and cases by name, file number, court case number or ID number.", { query: { type: "string" } }, ["query"]));
  if (can(user, "matters"))
    tools.push(spec("get_case", "Full details of one case by its file number (e.g. M-2026-0001): parties, hearings and decisions, deadlines, open tasks, recent timeline.", { fileNo: { type: "string" } }, ["fileNo"]));
  if (can(user, "tasks", "create"))
    tools.push(
      spec(
        "create_reminder",
        "Create a task assigned to the current user; the system reminds them before the due date. Use it when the user asks to be reminded of something or to add a to-do.",
        {
          title: { type: "string", maxLength: 300 },
          dueDate: { type: "string", description: "YYYY-MM-DD" },
          description: { type: "string", maxLength: 2000 },
          priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
          fileNo: { type: "string", description: "Optional case file number to link the task to" },
        },
        ["title", "dueDate"],
      ),
    );
  if (can(user, "clients"))
    tools.push(
      spec(
        "conflict_check",
        "Conflict-of-interest check: finds existing clients and adverse parties matching a name or ID number (Arabic letter variants included) and the cases they appear in. Results are leads for a lawyer to verify.",
        { name: { type: "string" } },
        ["name"],
      ),
    );
  tools.push(
    spec(
      "calculate_deadline",
      "Adds a number of calendar days to a start date (e.g. service or judgment date) and rolls the result past weekends and the office's holiday calendar. Statutory periods come from the office settings when a preset key is given (APPEAL, CASSATION, OBJECTION, EXECUTION). The result must be verified by a lawyer.",
      { startDate: { type: "string", description: "YYYY-MM-DD" }, days: { type: "integer", minimum: 1, maximum: 3650 }, preset: { type: "string" } },
      ["startDate"],
    ),
  );
  if (can(user, "billing")) tools.push(spec("get_unpaid_invoices", "Issued invoices with a balance due, oldest first, optionally for one client name.", { client: { type: "string" } }));
  return tools;
}

const args = {
  get_agenda: z.object({ days: z.number().int().min(1).max(31).optional() }),
  search: z.object({ query: z.string().trim().min(2).max(100) }),
  get_case: z.object({ fileNo: z.string().trim().min(1).max(40) }),
  create_reminder: z.object({
    title: z.string().trim().min(1).max(300),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    description: z.string().max(2000).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    fileNo: z.string().trim().max(40).optional(),
  }),
  get_unpaid_invoices: z.object({ client: z.string().trim().max(100).optional() }),
  conflict_check: z.object({ name: z.string().trim().min(2).max(100) }),
  calculate_deadline: z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    days: z.number().int().min(1).max(3650).optional(),
    preset: z.string().trim().max(40).optional(),
  }),
};

/** Runs one tool call; returns JSON text for the model. Errors are returned to the model, not thrown. */
export async function runTool(user: CurrentUser, name: string, rawArgs: string, actions: AssistantAction[]): Promise<string> {
  const allowed = toolsFor(user).some((t) => t.function.name === name);
  if (!allowed || !(name in args)) return JSON.stringify({ error: "This tool is not available to this user." });
  let parsed: unknown;
  try {
    parsed = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return JSON.stringify({ error: "Arguments are not valid JSON." });
  }
  const check = args[name as keyof typeof args].safeParse(parsed);
  if (!check.success) return JSON.stringify({ error: "Invalid arguments", issues: check.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
  const input = check.data as never;
  try {
    return JSON.stringify(await handlers[name as keyof typeof handlers](user, input, actions));
  } catch (e) {
    console.error("[assistant tool]", name, e);
    return JSON.stringify({ error: "The tool failed." });
  }
}

const handlers = {
  get_agenda: (user: CurrentUser, a: z.infer<typeof args.get_agenda>) => agendaFor(user, a.days ?? 7),

  search: async (user: CurrentUser, a: z.infer<typeof args.search>) => {
    const like = { contains: a.query, mode: "insensitive" as const };
    const [clients, cases] = await Promise.all([
      can(user, "clients")
        ? prisma.client.findMany({ where: { deletedAt: null, OR: [{ nameAr: like }, { nameEn: like }, { code: like }, { emiratesId: like }, { tradeLicenseNo: like }] }, take: 8 })
        : [],
      can(user, "matters")
        ? prisma.matter.findMany({
            where: { AND: [matterScope(user), { OR: [{ titleAr: like }, { titleEn: like }, { fileNo: like }, { courtCaseNo: like }, { client: { nameAr: like } }, { client: { nameEn: like } }] }] },
            include: { client: true },
            take: 8,
          })
        : [],
    ]);
    return {
      clients: clients.map((c) => ({ code: c.code, name: c.nameAr, nameEn: c.nameEn, phone: c.mobile || c.phone })),
      cases: cases.map((m) => ({ fileNo: m.fileNo, title: m.titleAr, client: m.client.nameAr, status: m.status, courtCaseNo: m.courtCaseNo })),
    };
  },

  get_case: async (user: CurrentUser, a: z.infer<typeof args.get_case>) => {
    const m = await prisma.matter.findFirst({
      where: { AND: [matterScope(user), { fileNo: { equals: a.fileNo, mode: "insensitive" } }] },
      include: {
        client: true,
        court: true,
        type: true,
        responsible: true,
        parties: { include: { party: true } },
        hearings: { where: { deletedAt: null }, include: { court: true }, orderBy: { date: "desc" }, take: 8 },
        deadlines: { where: { done: false }, orderBy: { dueDate: "asc" } },
        tasks: { where: { deletedAt: null, status: { not: "DONE" } }, include: { assignee: true }, take: 15 },
        events: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
    if (!m) return { error: "No case with this file number that the user can access." };
    const d = (x: Date) => x.toISOString().slice(0, 10);
    return {
      fileNo: m.fileNo,
      title: m.titleAr,
      status: m.status,
      level: m.level,
      stage: m.stage,
      courtCaseNo: m.courtCaseNo,
      court: m.court?.nameAr,
      type: m.type?.nameAr,
      client: { name: m.client.nameAr, capacity: m.clientRole, phone: m.client.mobile || m.client.phone },
      responsibleLawyer: m.responsible?.nameAr,
      parties: m.parties.map((p) => ({ role: p.role, name: p.party.nameAr })),
      hearings: m.hearings.map((h) => ({ date: d(h.date), court: h.court?.nameAr, status: h.status, decision: h.decision, requests: h.purpose })),
      openDeadlines: m.deadlines.map((x) => ({ title: x.title, due: d(x.dueDate) })),
      openTasks: m.tasks.map((x) => ({ title: x.title, due: x.dueDate ? d(x.dueDate) : null, assignee: x.assignee?.nameAr, status: x.status })),
      recentTimeline: m.events.map((e) => ({ date: d(e.createdAt), title: e.title, details: e.details })),
    };
  },

  create_reminder: async (user: CurrentUser, a: z.infer<typeof args.create_reminder>, actions: AssistantAction[]) => {
    let matterId: string | undefined;
    let clientId: string | undefined;
    if (a.fileNo) {
      const m = await prisma.matter.findFirst({ where: { AND: [matterScope(user), { fileNo: { equals: a.fileNo, mode: "insensitive" } }] } });
      if (!m) return { error: "No accessible case with this file number; ask the user to check it." };
      matterId = m.id;
      clientId = m.clientId;
    }
    const due = new Date(`${a.dueDate}T09:00:00`);
    if (isNaN(+due)) return { error: "Invalid due date." };
    const task = await prisma.task.create({
      data: { title: a.title, description: a.description, dueDate: due, priority: a.priority ?? "MEDIUM", status: "TODO", assigneeId: user.id, createdById: user.id, matterId, clientId },
    });
    await audit({ userId: user.id, action: "create", entity: "Task", entityId: task.id, data: { via: "assistant", title: a.title, dueDate: a.dueDate, fileNo: a.fileNo } });
    actions.push({ type: "task", id: task.id, title: task.title });
    return { created: true, title: task.title, dueDate: a.dueDate, fileNo: a.fileNo ?? null };
  },

  get_unpaid_invoices: async (user: CurrentUser, a: z.infer<typeof args.get_unpaid_invoices>) => {
    const like = a.client ? { contains: a.client, mode: "insensitive" as const } : undefined;
    const rows = await prisma.invoice.findMany({
      where: {
        deletedAt: null,
        status: { in: ["ISSUED", "PARTIALLY_PAID"] },
        ...(user.scopeAll ? {} : { OR: [{ matterId: null }, { matter: matterScope(user) }] }),
        ...(like ? { client: { OR: [{ nameAr: like }, { nameEn: like }] } } : {}),
      },
      include: { client: true },
      orderBy: { issueDate: "asc" },
      take: 20,
    });
    return rows.map((i) => ({ number: i.number, client: i.client.nameAr, issueDate: i.issueDate.toISOString().slice(0, 10), dueDate: i.dueDate?.toISOString().slice(0, 10), balance: `${balanceDue(i).toFixed(2)} ${i.currency}` }));
  },

  conflict_check: async (user: CurrentUser, a: z.infer<typeof args.conflict_check>) => {
    const { clients, parties } = await conflictCheck(a.name);
    // Case titles are only shown for cases the user may open; others are reported as existing without details.
    const visible = new Set(
      (await prisma.matter.findMany({ where: { AND: [matterScope(user), { OR: [{ clientId: { in: clients.map((c) => c.id) } }, { parties: { some: { partyId: { in: parties.map((p) => p.id) } } } }] }] }, select: { id: true } })).map(
        (m) => m.id,
      ),
    );
    const caseRef = (m: { id: string; fileNo: string; titleAr: string; status: string }) => (visible.has(m.id) ? { fileNo: m.fileNo, title: m.titleAr, status: m.status } : { fileNo: m.fileNo, restricted: true });
    return {
      note: "Name matches are not proof of a conflict; a lawyer must review them.",
      asClient: clients.map((c) => ({ code: c.code, name: c.nameAr, nameEn: c.nameEn, cases: c.matters.map(caseRef) })),
      asParty: parties.map((p) => ({ name: p.nameAr, nameEn: p.nameEn, cases: p.matters.map((x) => ({ ...caseRef(x.matter), role: x.role, client: visible.has(x.matter.id) ? x.matter.client.nameAr : undefined })) })),
    };
  },

  calculate_deadline: async (_user: CurrentUser, a: z.infer<typeof args.calculate_deadline>) => {
    const presets = await getDeadlinePresets();
    const preset = a.preset ? presets.find((p) => p.key.toLowerCase() === a.preset!.toLowerCase()) : undefined;
    const days = a.days ?? preset?.days;
    if (!days) return { error: "Give the number of days or one of the preset keys.", presets: presets.map((p) => ({ key: p.key, name: p.nameEn, days: p.days })) };
    const holidays = new Set((await prisma.holiday.findMany()).map((h) => h.date.toISOString().slice(0, 10)));
    const due = computeDueDate(new Date(`${a.startDate}T00:00:00`), days, holidays);
    return { startDate: a.startDate, days, preset: preset?.key, dueDate: isoDate(due), rule: "calendar days, rolled forward past Saturday/Sunday and office holidays", verify: "Check the statutory period and how it is counted for this case before relying on this date." };
  },
};
