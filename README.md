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

## Source structure

```text
src/
├── app/             Pages and page-level state
├── components/      Small reusable UI building blocks
├── lib/db/          Supabase queries and mutations
├── lib/errors.ts    Safe conversion of unknown errors into messages
├── lib/today.ts     Shared local-date and "today" rules
└── types/           Reusable application data types
```

Pages should not duplicate database queries or domain rules. Database access
belongs in `src/lib/db`, reusable rules belong in `src/lib`, and shared data
shapes belong in `src/types`. Reusable visual primitives live in
`src/components/ui.tsx`; authenticated pages share `src/components/AppNav.tsx`;
theme colours and global visual tokens live in `src/app/globals.css`. This keeps page code readable without adding a large UI
framework.

## Data model

- `tasks`: one-time items that may have a due time;
- `routines`: reusable daily or weekly plans;
- `daily_checkins`: one row per user and local calendar day;
- `checkin_items`: completion state for each task or routine in a check-in.

Supabase Row Level Security restricts every user to their own rows. Database
schema migrations are not yet versioned in this repository and should be added
before the project has multiple deployment environments.

## Current milestone

The core routine/task/check-in flow is implemented, routine editing is supported,
and the shared UI foundation is in place. Dashboard, check-in, and routines now
use one consistent navigation pattern, friendly date formatting, and automatic
refresh after mutations instead of manual Refresh controls. Finishing a daily
check-in now leaves a clear completed state and can be reopened for edits. The
current visual system intentionally uses a single controlled light theme so
contrast stays predictable; a deliberate dark theme can be added later without
relying on browser/system defaults.

## Roadmap

1. Test the polished core flow with real daily use.
2. Add check-in history and forgiving streaks.
3. Design an anti-farming points system.
4. Add earned personalisation and optional notifications.
5. Prepare the web app as a PWA before considering native mobile clients.
