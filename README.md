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

Account deletion is handled only by a server route. To enable it, also add the
Supabase service-role key to the server environment:

```env
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:you@example.com
NOTIFICATION_CRON_SECRET=use-a-long-random-secret
```

Never expose the service-role or private VAPID keys in browser code or commit it to the repository.
The `.env*` files are ignored by Git.

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
npm test          # Unit/contract tests
npm run verify    # Tests + lint + type generation/typecheck + production build
npm run archive:safe # Create a source archive from tracked Git files only
```

## Routes

| Route | Responsibility |
| --- | --- |
| `/` | Entry route; sends the user to the correct authenticated/public surface |
| `/login` | Email/password login and signup |
| `/forgot-password` | Request a password-reset email |
| `/reset-password` | Choose a new password after recovery |
| `/auth/callback` | Complete email confirmation and auth callback handling |
| `/dashboard` | Task management and today's overview |
| `/routines` | Create, edit, pause, resume, and delete daily/weekly routines |
| `/checkin` | Daily completion ritual for today's items |
| `/history` | Recent check-ins, rhythm, points, and missed-day recovery |
| `/health` | Medication plans, due reminders, taken state, and history |
| `/workouts` | Workout plans, sessions, completion, and history |
| `/settings` | Profile, email, password, appearance, language, data, and account controls |
| `/feedback` | Private-alpha bug reports, friction notes, and ideas |
| `/guide` | Install, reminder, and product guidance |
| `/onboarding` | First-use setup and starter routine flow |
| `/design-lab` | Authenticated, noindex, desktop-only developer theme preview |

Server routes live under `src/app/api`: account export/deletion, client-error
collection, notification delivery/subscription management, and offline mutation
sync. Auth recovery also has a dedicated route handler under `/auth/recovery`.

## Source structure

```text
src/
├── app/                 App Router pages, route handlers, global styles, and route state
├── components/          Shared UI and interaction components
│   └── life/            Health/workout shared navigation and life-management UI
├── lib/
│   ├── db/              Supabase queries and mutations
│   ├── i18n/            English/Persian dictionaries and translation helpers
│   ├── server/          Server-only auth, rate limiting, push, and agent boundaries
│   ├── supabase/        Request-scoped Supabase server/proxy helpers
│   └── *.ts             Reusable domain, schedule, theme, date, and offline rules
└── types/               Reusable application and generated database data shapes

public/                  PWA service worker and offline shell
supabase/migrations/     Versioned PostgreSQL schema and function changes
tests/                   Audit, domain, i18n, and PWA contract tests
docs/                    Architecture and product implementation notes
```

Pages should not duplicate/ database queries or domain rules. Database access
belongs in `src/lib/db`, reusable rules belong in `src/lib`, and shared data
shapes belong in `src/types`. Reusable visual primitives live in
`src/components/ui.tsx`; authenticated pages share `src/components/AppNav.tsx`;
theme colours and global visual tokens live in `src/app/globals.css`; time-of-day overrides and RTL foundations live in `src/app/foundations.css`. See `docs/application-architecture.md` for the current server/client, data, PWA, and theme boundaries.

## Data model

- `tasks`: one-time items that may have a due time;
- `routines`: reusable daily or weekly plans;
- `daily_checkins`: one row per user and local calendar day; `completed_at` distinguishes in-progress daily activity from a finished check-in;
- `checkin_items`: completion state for each task or routine in a check-in;
- `profiles`: display name and onboarding state;
- `point_transactions`: append-only rewards and recovery spending;
- `streak_repairs`: missed calendar days whose rhythm continuity was repaired;
- `notification_preferences`: opt-in reminder time and device timezone;
- `push_subscriptions`: server-managed Web Push device subscriptions;
- `feedback`: private-alpha feedback owned by the submitting user.

Supabase Row Level Security restricts users to their own readable rows. Point
transactions and repairs cannot be written directly by the browser: rewards are
created by a database trigger and repairs go through a protected database
function.

## Database migrations

Database changes are versioned under `supabase/migrations`. Apply them in order;
do not cherry-pick old milestone migrations into an already-current database.
`supabase/MIGRATIONS.md` records operational notes, and the live schema should
match the committed migration chain.

Refresh `src/types/database.ts` from the live/linked Supabase schema after any
table or RPC signature change.

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

Settings now provides profile editing, email and password changes, appearance,
session controls, server-side account deletion, PWA installation guidance, and
opt-in daily Web Push reminders. Routine is installable as a PWA on supported Android and iOS devices. The installed app keeps a privacy-limited snapshot of today's routine/task completion, supports offline completion/check-in queuing, and synchronises queued mutations when connectivity returns.
The private-alpha pass also includes stricter database privileges and RLS,
protected server endpoints, production security headers, safer user-facing error
messages, mobile keyboard/sheet fixes, and an in-app feedback flow.

## Roadmap

1. Use the private alpha with a small group and collect feedback in the app.
2. Fix repeated friction and mobile/PWA edge cases found by real use.
3. Revisit onboarding and account verification before a wider release.
4. Adjust points and recovery only after observing real behaviour.
5. Add earned personalisation without turning the app into a high-pressure game.


## Notification scheduler

The repository defines the reminder scheduler in
`.github/workflows/notifications-cron.yml`. It calls the protected notification
endpoint every 15 minutes.

Before enabling that workflow on `main`, configure these GitHub repository
settings:

- Actions secret `NOTIFICATION_CRON_SECRET`: the same value used by the
  production server environment.
- Actions variable `ROUTINE_PRODUCTION_URL`: the canonical production origin,
  without a trailing slash.

The endpoint remains idempotent: daily reminders track `last_sent_on`, and push
deliveries are claimed before transmission. Never put either secret value in a
repository file.
