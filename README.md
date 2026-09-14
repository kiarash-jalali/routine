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
| `/routines` | Create, edit, pause, resume, and delete daily or weekly routines |
| `/checkin` | Daily completion ritual for today's items |

## Source structure

```text
src/
├── app/             Pages and page-level state
├── components/      Shared UI plus small feature-specific components
├── lib/db/          Supabase queries and mutations
├── lib/errors.ts    Safe conversion of unknown errors into messages
├── lib/routineSchedule.ts  Routine form/schedule helpers
├── lib/today.ts     Shared local-date and "today" rules
└── types/           Reusable application data types
```

Pages should not duplicate database queries or domain rules. Database access
belongs in `src/lib/db`, reusable rules belong in `src/lib`, and shared data
shapes belong in `src/types`. Reusable visual primitives live in
`src/components/ui.tsx`; theme colours and global visual tokens live in
`src/app/globals.css`. This keeps page code readable without adding a large UI
framework.

## Data model

- `tasks`: one-time items that may have a due time;
- `routines`: reusable daily or weekly plans;
- `daily_checkins`: one row per user and local calendar day;
- `checkin_items`: completion state for each task or routine in a check-in.

Supabase Row Level Security restricts every user to their own rows. Database
schema migrations are not yet versioned in this repository and should be added
before the project has multiple deployment environments.

## Roadmap

1. Keep testing and polishing the current task, routine, and daily check-in flows.
2. Add check-in history and forgiving streaks.
3. Design an anti-farming points system.
4. Add earned personalisation and optional notifications.
5. Prepare the web app as a PWA before considering native mobile clients.
