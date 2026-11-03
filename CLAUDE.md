# Working rules for this repository

Law office management system (UAE) — Next.js 15 App Router, TypeScript, Prisma + PostgreSQL, next-intl (ar/en, RTL).

- Implement one phase at a time and stop for review.
- Every module follows the same layout:
  - `src/server/<module>/schema.ts` — Zod schemas (pure, shared with client forms through `src/server/schemas.ts`)
  - `src/server/<module>/actions.ts` — server actions built with `defineAction` from `src/lib/action.ts`
  - `src/server/<module>/queries.ts` — read queries used by server components
  - `src/app/[locale]/(dashboard)/<module>/` — list, detail (`[id]`), new and edit pages
- No hard-coded UI text. All strings live in `messages/ar.json` and `messages/en.json`; run `npm run i18n:check`.
- Every server action checks permissions on the server and writes to the audit log (`defineAction` does both).
- Matter-level data must be filtered with `matterScope(user)` for roles that only see assigned matters.
- Money is `Decimal(14,2)` in the database and `Prisma.Decimal` in code (`src/lib/money.ts`); never use floats for totals.
- Financial logic (VAT, gratuity, journal entries, WPS) lives in pure functions under `src/lib/` with unit tests in `tests/unit`.
- Soft delete with `deletedAt`; always filter `deletedAt: null`.
- At the end of each phase run `npm run db:migrate`, `npm run lint`, `npm run typecheck`, `npm test`, and update `prisma/seed-demo.ts`.
