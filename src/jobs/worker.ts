import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { runReminders } from "./reminders";

const QUEUE = "reminders";
const EVERY_MS = Number(process.env.REMINDER_INTERVAL_MS ?? 15 * 60 * 1000);

async function main() {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.log("[worker] REDIS_URL not set, running on a timer");
    const tick = () => runReminders().then((c) => console.log("[reminders]", c)).catch(console.error);
    await tick();
    setInterval(tick, EVERY_MS);
    return;
  }
  const connection = new IORedis(url, { maxRetriesPerRequest: null });
  const queue = new Queue(QUEUE, { connection });
  await queue.upsertJobScheduler("reminders-every", { every: EVERY_MS }, { name: "run" });
  new Worker(
    QUEUE,
    async () => {
      const counts = await runReminders();
      console.log("[reminders]", counts);
      return counts;
    },
    { connection, concurrency: 1 },
  );
  console.log(`[worker] reminders every ${EVERY_MS / 60000} min`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
