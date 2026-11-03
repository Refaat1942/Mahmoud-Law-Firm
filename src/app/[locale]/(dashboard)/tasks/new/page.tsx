import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { EntityForm } from "@/components/entity-form";
import { PageHeader, Section } from "@/components/page";
import { createTask } from "@/server/tasks/actions";
import { taskScope } from "@/server/tasks/queries";
import { taskFields } from "../fields";

export default async function NewTaskPage({ searchParams }: { searchParams: Promise<{ matterId?: string; clientId?: string; parentId?: string }> }) {
  const user = await requirePermission("tasks", "create");
  const t = await getTranslations();
  const sp = await searchParams;
  const parent = sp.parentId ? await prisma.task.findFirst({ where: { AND: [taskScope(user), { id: sp.parentId }] } }) : null;
  return (
    <>
      <PageHeader title={parent ? t("tasks.newSubtask") : t("tasks.new")} subtitle={parent?.title} />
      <Section>
        <EntityForm
          fields={await taskFields(user, { parentOptions: parent ? [{ value: parent.id, label: parent.title }] : undefined })}
          schema="task"
          action={createTask}
          defaultValues={{
            matterId: sp.matterId ?? parent?.matterId,
            clientId: sp.clientId ?? parent?.clientId,
            parentId: parent?.id,
            assigneeId: parent?.assigneeId ?? user.id,
            priority: parent?.priority ?? "MEDIUM",
            status: "TODO",
          }}
          redirectTo="/tasks/:id"
        />
      </Section>
    </>
  );
}
