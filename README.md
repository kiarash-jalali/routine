# Routine Helper

Routine Helper is a calm, routine-first productivity app. It is designed around
daily shaping rather than strict scheduling: routines provide structure, tasks
capture one-time work, and the daily check-in records what actually happened.

The project prioritises:

- discipline without pressure;
- progress compared with your own history;
- forgiving, anti-overwhelm interactions;
- code that remains understandable and easy to change.

## Technology

- Next.js App Router
- React and TypeScript
- Tailwind CSS
- Supabase authentication and PostgreSQL database

Next.js 16 requires Node.js 20.9 or newer.

## Local setup

Create `.env.local` in the project root with your Supabase public credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Install the locked dependency versions and start the development server:

```bash
npm ci
npm run dev
```

On Windows PowerShell, if script execution blocks `npm.ps1`, use:

```powershell
npm.cmd ci
npm.cmd run dev
```

Then open [http://localhost:3000](http://localhost:3000). Stop the server with
`Ctrl+C`.

## Useful commands

```bash
npm run dev       # Development server with live reload
npm run lint      # ESLint code-quality checks
npx tsc --noEmit  # TypeScript type check
npm run build     # Production build check
```

## Routes

| Route | Responsibility |
| --- | --- |
| `/login` | Email/password login and signup |
| `/dashboard` | Task management and today's overview |
| `/routines` | Create, edit, pause, resume, and delete daily/weekly routines |
| `/checkin` | Daily completion ritual for today's items |
| `/history` | Recent check-ins, rhythm, points, and missed-day recovery |

## Source structure

```text
src/
├── app/             Pages and page-level state
├── components/      Small reusable UI building blocks
├── lib/db/          Supabase queries and mutations
├── lib/errors.ts    Safe conversion of unknown errors into messages
├── lib/history.ts   Check-in history calculations
├── lib/points.ts    Point and recovery domain rules
├── lib/streak.ts    Forgiving streak calculations
├── lib/today.ts     Shared local-date and "today" rules
└── types/           Reusable application data types
```

Pages should not duplicate database queries or domain rules. Database access
belongs in `src/lib/db`, reusable rules belong in `src/lib`, and shared data
shapes belong in `src/types`. Reusable visual primitives live in
`src/components/ui.tsx`; authenticated pages share `src/components/AppNav.tsx`;
theme colours and global visual tokens live in `src/app/globals.css`.

## Data model

- `tasks`: one-time items that may have a due time;
- `routines`: reusable daily or weekly plans;
- `daily_checkins`: one row per user and local calendar day;
- `checkin_items`: completion state for each task or routine in a check-in;
- `point_transactions`: append-only rewards and recovery spending;
- `streak_repairs`: missed calendar days whose rhythm continuity was repaired.

Supabase Row Level Security restricts users to their own readable rows. Point
transactions and repairs cannot be written directly by the browser: rewards are
created by a database trigger and repairs go through a protected database
function.

## Database migrations

Database changes are versioned under `supabase/migrations`.

For the points/recovery milestone, run this migration once in the Supabase SQL
Editor before testing the updated History page:

```text
supabase/migrations/202609151100_add_points_and_streak_recovery.sql
```

The migration also backfills existing finished check-ins with 10 points each, so
old check-ins participate in the same economy without needing to be recreated.

## Current milestone

The core routine/task/check-in flow is implemented, routine editing is supported,
and the shared UI foundation is in place. History shows recent check-ins and a
14-day rhythm view. The forgiving streak is derived from finished daily check-ins:
showing up counts even when completion is not 100%, and a streak that was active
yesterday remains alive during the current day until the user has had a chance to
check in.

Points + missed-day recovery v1 adds these rules:

- the first finished check-in for a calendar day earns 10 points;
- editing the same day never awards points again;
- one missed rhythm day costs 30 points to repair;
- a day can only be repaired after a real check-in exists both before and after it;
- a repair restores streak continuity only and never creates fake completion data;
- repaired days are visually distinct from real check-ins in History.

## Roadmap

1. Test points and recovery with several real days and one intentional gap.
2. Adjust reward/cost numbers only after observing real use.
3. Add earned personalisation without turning the app into a high-pressure game.
4. Add optional notifications.
5. Prepare the web app as a PWA before considering native mobile clients.
