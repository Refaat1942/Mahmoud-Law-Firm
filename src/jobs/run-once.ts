import { prisma } from "@/lib/prisma";
import { runReminders } from "./reminders";

runReminders()
  .then((counts) => console.log("[reminders]", counts))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
