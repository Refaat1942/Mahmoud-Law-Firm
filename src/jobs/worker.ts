import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { runReminders } from "./reminders";
import { runBriefings } from "./briefing";

const QUEUE = "reminders";
const EVERY_MS = Number(process.env.REMINDER_INTERVAL_MS ?? 15 * 60 * 1000);
const HOUR_MS = 60 * 60 * 1000;

const reminders = () => runReminders().then((c) => (console.log("[reminders]", c), c));
// Checked hourly; runBriefings only sends at the hour chosen in Settings, once per user per day.
const briefings = () => runBriefings().then((c) => (c.sent ? console.log("[briefing]", c) : undefined, c));

async function main() {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.log("[worker] REDIS_URL not set, running on a timer");
    await reminders().catch(console.error);
    setInterval(() => reminders().catch(console.error), EVERY_MS);
    setInterval(() => briefings().catch(console.error), HOUR_MS);
    return;
  }
  const connection = new IORedis(url, { maxRetriesPerRequest: null });
  const queue = new Queue(QUEUE, { connection });
  await queue.upsertJobScheduler("reminders-every", { every: EVERY_MS }, { name: "run" });
  await queue.upsertJobScheduler("briefing-hourly", { pattern: "2 * * * *", tz: "Asia/Dubai" }, { name: "briefing" });
  new Worker(QUEUE, async (job) => (job.name === "briefing" ? briefings() : reminders()), { connection, concurrency: 1 });
  console.log(`[worker] reminders every ${EVERY_MS / 60000} min, briefing check hourly`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
