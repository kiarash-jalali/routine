# Application architecture

Rootine uses the Next.js App Router with a server-first boundary for authenticated
initial reads and small client components for interaction.

## Request and auth boundary

`src/proxy.ts` applies the CSP and delegates protected-route session refresh to
`src/lib/supabase/proxy.ts`. Authenticated Server Components use
`requireServerUser()` and a request-scoped Supabase client. Browser clients are
reserved for user-initiated mutations and interactive refreshes.

The service-role key is server-only. Privileged API routes authenticate the current
user before any user-scoped operation, and database RLS remains the primary row
ownership boundary.

## Data access

Reusable database reads and mutations live in `src/lib/db`. Query modules select
explicit columns rather than `select("*")`, keeping payload contracts intentional.
Generated Supabase types live in `src/types/database.ts` and must be refreshed
after schema or RPC changes.

The points economy is configured by the singleton `public.point_rules` row.
Award and repair database functions read the same row, and the History page loads
those rules from `get_point_rules()`; reward/cost values therefore have one
database source of truth.

## Server and client rendering

Authenticated pages fetch initial data on the server. Client components own local
editing state, optimistic interaction, animation, PWA state, and browser APIs.
Avoid moving initial authenticated reads back into mount-time effects unless a
browser-only API genuinely requires it.

## Offline/PWA boundary

The service worker and `public/offline.js` provide a bounded offline workflow.
Only routine/task titles and today's completion state are cached. Routine/task
completion and final daily check-in can be queued in IndexedDB and are replayed
through the authenticated `/api/offline/sync` boundary.

Health and medication data are deliberately excluded from offline snapshots.
Routine/task create, edit, and delete still require connectivity. A stale-day
snapshot is read-only so yesterday's plan cannot be written as today's state.

## Theme and design system

`src/app/globals.css` is the single owner of the core visual system and component
styles. `src/app/foundations.css` contains time-of-day palette overrides, RTL,
Persian font, and small foundation-level adjustments.

The four appearance modes are:

- **Automatic time-of-day:** morning/day/evening palettes are light and night is dark.
- **Follow device:** light/dark follows `prefers-color-scheme`.
- **Light:** fixed light.
- **Dark:** fixed dark.

`src/lib/theme.ts` owns both the runtime period calculation and the first-paint
script generation so the hour boundaries cannot drift independently.

## Translation boundary

User-facing product copy belongs in `src/lib/i18n/en.ts` and `fa.ts`. ESLint
rejects untranslated JSX literals in application/components code, with Design Lab
excluded because it is an authenticated developer-only preview tool. Translation
dictionary parity is also covered by tests.

## Change discipline

- Keep UI primitives in shared components rather than page-specific clones.
- Add schema changes as ordered Supabase migrations and regenerate DB types.
- Preserve explicit server/client and privilege boundaries.
- Run `npm run verify` before merging.
- For PWA changes, test both online and offline/reconnect behavior.
