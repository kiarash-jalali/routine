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
```

Never expose the service-role key in browser code or commit it to the repository.
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
npm run verify    # Lint + type generation/typecheck + production build
npm run archive:safe # Create a source archive from tracked Git files only
```

## Routes

| Route | Responsibility |
| --- | --- |
| `/login` | Email/password login and signup |
| `/forgot-password` | Request a password-reset email |
| `/reset-password` | Choose a new password after recovery |
| `/dashboard` | Task management and today's overview |
| `/routines` | Create, edit, pause, resume, and delete daily/weekly routines |
| `/checkin` | Daily completion ritual for today's items |
| `/history` | Recent check-ins, rhythm, points, and missed-day recovery |
| `/settings` | Profile, email, password, appearance, session, and account controls |
| `/feedback` | Private-alpha bug reports, friction notes, and ideas |

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

Database changes are versioned under `supabase/migrations`.

For the points/recovery milestone, run this migration once in the Supabase SQL
Editor before testing the updated History page:

```text
supabase/migrations/202609151100_add_points_and_streak_recovery.sql
```

Profiles and first-time onboarding use:

```text
supabase/migrations/202609151330_add_profiles_and_onboarding.sql
```

The points migration also backfills existing finished check-ins with 10 points
each, so old check-ins participate in the same economy without needing to be
recreated.

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
session controls, server-side account deletion, and opt-in daily Web Push
reminders. Routine is installable as a PWA on supported Android and iOS devices.
The private-alpha pass also includes stricter database privileges and RLS,
protected server endpoints, production security headers, safer user-facing error
messages, mobile keyboard/sheet fixes, and an in-app feedback flow.

## Roadmap

1. Use the private alpha with a small group and collect feedback in the app.
2. Fix repeated friction and mobile/PWA edge cases found by real use.
3. Revisit onboarding and account verification before a wider release.
4. Adjust points and recovery only after observing real behaviour.
5. Add earned personalisation without turning the app into a high-pressure game.
