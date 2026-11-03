import type { PrismaClient } from "@prisma/client";

/** Demo data is filled in during the QA phase; kept as a separate module so production seeds can skip it. */
export async function seedDemo(_prisma: PrismaClient) {}
