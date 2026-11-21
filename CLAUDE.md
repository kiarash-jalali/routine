@AGENTS.md

# rootine — project guide for Claude

Rootine (package name `routine-helper`) is a calm, routine-first PWA: routines give
structure, tasks capture one-off work, and the daily check-in records what actually
happened. Owner and sole developer: Kiarash. English + Persian (RTL) from day one.

Product principles — every feature must respect them:
- discipline without pressure; compare only with the user's own history;
- forgiving, anti-overwhelm interactions (streak repair, skippable onboarding);
- the app must earn daily use. If a feature adds a step, it must remove a bigger one.

## Stack

Next.js 16 App Router (see AGENTS.md — read `node_modules/next/dist/docs/` before
using an API you are unsure of), React 19 with React Compiler, TypeScript strict
(`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), Tailwind 4, Supabase
(Postgres + Auth + pg_cron), Web Push, Vercel. Tests use `node --test`.

## Commands

```bash
npm run dev          # local dev server
npm test             # node --test tests/*.test.mjs
npm run lint         # ESLint (also rejects untranslated JSX strings)
npm run typecheck    # next typegen && tsc --noEmit
npm run verify       # test + lint + typecheck + build — must pass before any commit
```

The developer works on Windows. In PowerShell, `npm.cmd` may be needed instead of `npm`.

## Where things live

- `src/app/<route>/page.tsx` server component fetches initial data; `<Route>Client.tsx` handles interaction.
- `src/lib/db/*` — all reusable Supabase reads/mutations. Select explicit columns, never `select("*")`.
- `src/lib/server/*` — server-only code (`import "server-only"`): rate limits, push, request auth.
- `src/lib/i18n/en.ts` + `fa.ts` — every user-facing string. Parity is tested.
- `src/components/ui.tsx` — shared primitives. Reuse them; don't clone page-specific variants.
- `src/app/globals.css` owns the design system; `foundations.css` holds palettes/RTL/Persian font.
- `supabase/migrations/` — ordered SQL. Read `supabase/MIGRATIONS.md` before touching it.
- `docs/` — architecture, life-management (health/workouts/notifications), agent boundary.

## Non-negotiable rules

1. **i18n:** no literal UI strings in JSX. Add keys to both `en.ts` and `fa.ts` in the same change.
   Check RTL layout for anything with direction (icons, margins, number alignment).
2. **Auth & data:** RLS is the ownership boundary. New tables: enable RLS, owner policies for
   SELECT/INSERT/UPDATE/DELETE (UPDATE needs USING + WITH CHECK), no anon grants.
   Service-role key only in server code, only after authenticating the user.
3. **Schema changes:** new migration file only (never edit old ones), then regenerate
   `src/types/database.ts`, then run Supabase security advisors. Use the `db-change` skill.
4. **Health data** (medications, notes) never goes into push payloads, logs, analytics,
   offline snapshots or the planning-agent snapshot.
5. **Server-first:** initial authenticated reads happen on the server. Don't move them into
   `useEffect` unless a browser-only API requires it.
6. **Offline:** only routine/task titles and today's completion state are cached. Changes to
   PWA/offline code must be checked online and offline → reconnect.
7. **Production database:** this repo is connected to the live Supabase project. Ask before any
   write, DDL or destructive SQL. Read-only queries and advisors are fine.

## Workflow

- Use plan mode for anything touching more than one file or the database. Get approval first.
- Keep changes small and focused; one concern per branch/PR. Branch names: `feat/…`, `fix/…`, `chore/…`.
- Before committing: `npm run verify`, then ask the `reviewer` subagent to review the diff.
- Use `/ship` to run the full verify → review → commit → PR sequence.
- Never commit `.env*` files or secrets. Vercel auto-deploy from git is intentionally off
  (`vercel.json`); production deploys are manual.
