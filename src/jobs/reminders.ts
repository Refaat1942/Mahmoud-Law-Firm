import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { getOffice } from "@/lib/settings";
import { addDays, startOfDay } from "@/lib/utils";

const EXPIRY_WINDOW_DAYS = 30;
const OVERDUE_REPEAT_DAYS = 7;

function fmt(d: Date, withTime = false) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  }).format(d);
}

/** True when the same notification was already sent to this user within `days`. */
async function recentlyNotified(userId: string, type: string, link: string, days: number) {
  const found = await prisma.notification.findFirst({
    where: { userId, type, link, createdAt: { gte: addDays(new Date(), -days) } },
    select: { id: true },
  });
  return !!found;
}

async function usersWith(module: string, action: string) {
  const users = await prisma.user.findMany({
    where: { isActive: true, deletedAt: null, clientId: null, role: { permissions: { some: { module, action } } } },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

async function matterRecipients(matter: { responsibleId: string | null; members: { userId: string }[] }, primary?: string | null) {
  return [...new Set([primary, matter.responsibleId, ...matter.members.map((m) => m.userId)].filter(Boolean) as string[])];
}

export async function runReminders(now = new Date()) {
  const office = await getOffice();
  const horizon = addDays(startOfDay(now), office.reminderDaysBefore + 1);
  const counts = { hearings: 0, deadlines: 0, tasks: 0, appointments: 0, notices: 0, poa: 0, employeeDocs: 0, invoices: 0 };

  const hearings = await prisma.hearing.findMany({
    where: { deletedAt: null, status: "SCHEDULED", reminderSent: false, date: { gte: now, lt: horizon }, matter: { deletedAt: null } },
    include: { court: true, matter: { include: { members: true } } },
  });
  for (const h of hearings) {
    for (const userId of await matterRecipients(h.matter, h.lawyerId)) {
      await notify({
        userId,
        type: "hearing",
        template: "hearingReminder",
        vars: { matter: `${h.matter.fileNo} ${h.matter.titleAr}`, date: fmt(h.date, true), court: h.court?.nameAr ?? "" },
        link: `/hearings/${h.id}`,
      });
    }
    await prisma.hearing.update({ where: { id: h.id }, data: { reminderSent: true } });
    counts.hearings++;
  }

  const deadlines = await prisma.deadline.findMany({
    where: { done: false, reminderSent: false, dueDate: { lt: horizon }, matter: { deletedAt: null } },
    include: { matter: { include: { members: true } } },
  });
  for (const d of deadlines) {
    for (const userId of await matterRecipients(d.matter, d.assigneeId)) {
      await notify({
        userId,
        type: "deadline",
        template: "deadlineReminder",
        vars: { title: d.title, matter: d.matter.fileNo, date: fmt(d.dueDate) },
        link: `/cases/${d.matterId}?tab=deadlines`,
      });
    }
    await prisma.deadline.update({ where: { id: d.id }, data: { reminderSent: true } });
    counts.deadlines++;
  }

  const tasks = await prisma.task.findMany({
    where: { deletedAt: null, status: { not: "DONE" }, reminderSent: false, assigneeId: { not: null }, dueDate: { lt: horizon } },
  });
  for (const task of tasks) {
    await notify({ userId: task.assigneeId!, type: "task", template: "taskReminder", vars: { title: task.title, date: fmt(task.dueDate!) }, link: `/tasks/${task.id}` });
    await prisma.task.update({ where: { id: task.id }, data: { reminderSent: true } });
    counts.tasks++;
  }

  const appointments = await prisma.appointment.findMany({
    where: { deletedAt: null, status: "SCHEDULED", reminderSent: false, startAt: { gte: now, lt: horizon } },
    include: { attendees: true },
  });
  for (const a of appointments) {
    for (const userId of new Set([a.organizerId, ...a.attendees.map((x) => x.userId)])) {
      await notify({
        userId,
        type: "appointment",
        template: "appointmentReminder",
        vars: { title: a.title, date: fmt(a.startAt, true), location: a.location ?? a.onlineLink ?? "" },
        link: `/appointments/${a.id}`,
      });
    }
    await prisma.appointment.update({ where: { id: a.id }, data: { reminderSent: true } });
    counts.appointments++;
  }

  // Notices without a case have no Deadline row; their due date is reminded here.
  const notices = await prisma.legalNotice.findMany({
    where: { deletedAt: null, reminderSent: false, deadlineId: null, dueDate: { lt: horizon } },
  });
  for (const n of notices) {
    const recipients = n.assigneeId ? [n.assigneeId] : n.createdById ? [n.createdById] : [];
    for (const userId of recipients) {
      await notify({ userId, type: "notice", template: "noticeDeadline", vars: { title: n.title, counterparty: n.counterparty, date: fmt(n.dueDate!) }, link: `/notices/${n.id}` });
    }
    await prisma.legalNotice.update({ where: { id: n.id }, data: { reminderSent: true } });
    counts.notices++;
  }

  const expiryHorizon = addDays(startOfDay(now), EXPIRY_WINDOW_DAYS);

  const poas = await prisma.powerOfAttorney.findMany({
    where: { deletedAt: null, expiresAt: { gte: startOfDay(now), lt: expiryHorizon }, client: { deletedAt: null } },
    include: { client: true },
  });
  if (poas.length) {
    const recipients = await usersWith("clients", "update");
    for (const p of poas) {
      const link = `/clients/${p.clientId}`;
      for (const userId of recipients) {
        if (await recentlyNotified(userId, `poa:${p.id}`, link, EXPIRY_WINDOW_DAYS)) continue;
        await notify({
          userId,
          type: `poa:${p.id}`,
          template: "expiryReminder",
          vars: { title: `${p.number} — ${p.client.nameAr}`, date: fmt(p.expiresAt!) },
          link,
        });
      }
      counts.poa++;
    }
  }

  const docs = await prisma.employeeDocument.findMany({
    where: { reminderSent: false, expiryDate: { lt: expiryHorizon }, employee: { deletedAt: null, status: { not: "TERMINATED" } } },
    include: { employee: true },
  });
  if (docs.length) {
    const recipients = await usersWith("hr", "update");
    for (const d of docs) {
      for (const userId of recipients) {
        await notify({
          userId,
          type: "employeeDoc",
          template: "expiryReminder",
          vars: { title: `${d.type} ${d.number} — ${d.employee.nameAr}`, date: fmt(d.expiryDate!) },
          link: `/hr/employees/${d.employeeId}`,
        });
      }
      await prisma.employeeDocument.update({ where: { id: d.id }, data: { reminderSent: true } });
      counts.employeeDocs++;
    }
  }

  const overdue = await prisma.invoice.findMany({
    where: { deletedAt: null, status: { in: ["ISSUED", "PARTIALLY_PAID"] }, dueDate: { lt: startOfDay(now) } },
    include: { client: true },
  });
  if (overdue.length) {
    const recipients = await usersWith("billing", "update");
    for (const inv of overdue) {
      const link = `/billing/invoices/${inv.id}`;
      for (const userId of recipients) {
        if (await recentlyNotified(userId, "invoiceOverdue", link, OVERDUE_REPEAT_DAYS)) continue;
        await notify({ userId, type: "invoiceOverdue", template: "invoiceOverdue", vars: { number: inv.number, client: inv.client.nameAr, date: fmt(inv.dueDate!) }, link });
      }
      counts.invoices++;
    }
  }

  return counts;
}
