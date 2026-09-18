# Life-management foundation

## Delivered boundaries

- `lib/i18n`: typed English/Farsi dictionaries, English fallback. Account locale lives in `profiles`; local storage supplies first paint. New-user signup metadata initializes locale, without affecting authorization. New surfaces and major headings are translated; some older detail/error/moment copy remains English for gradual migration.
- `lib/theme` plus ThemeController: device-local morning 05–11, day 11–17, evening 17–21, night 21–05. Existing explicit light/dark values stay intact; absent preference means automatic. CSS tokens and reduced-motion rules govern transitions.
- Onboarding: three skippable introductory screens, optional name/routine setup, durable intro state, no repeat for completed users. First-routine reminder introduction is atomically claimed once per account.
- Health: private medication plans and scheduled reminder snapshots. Dose text is never parsed medically. Past records survive edits/pause; edits apply from their effective timestamp. Materialization creates through tomorrow and can fill the last 30 days after downtime. Daily labels use each plan's saved timezone. “Missed” only means no taken record after scheduled time.
- Workouts: separate plans and sessions, optional exercise text, actual duration on completion, manual logging and history. No AI dependency, calorie estimation or points changes.

## Notifications

Reuse the existing five-minute Supabase cron job, POST `/api/notifications/send`, VAPID environment variables and subscriptions. Encrypted payloads contain only central generic translated copy and an allowlisted app path. No medication names, doses or notes enter push payloads or logs. Health and workout reminders have a one-hour late-delivery window and five-minute push TTL. Paused/completed events are excluded at query time. Delivery is best effort, not an alarm guarantee; users can always view schedules in the app. Simultaneous categories use separate notification tags.

`push_deliveries` leases each subscription/event pair atomically for five minutes, caps attempts at five and retains only 30 days of transport metadata. A provider acceptance is not proof the device displayed the notification. At-least-once delivery can still duplicate if a process dies after provider acceptance but before recording the result. The notification tag coalesces same-category lock-screen messages. The current alpha sender processes at most 100 due events per category per run; move to bounded workers if volume warrants it.

Daily check-in disable does not unsubscribe health/workout reminders. Settings can separately unsubscribe this device. Permission is requested only by a contextual button click. iOS needs an installed Home Screen PWA. A saved plan's reminder checkbox does not itself grant device permission.

## Data security and verification

Versioned additive migrations enable RLS before application access. New owner SELECT/INSERT/UPDATE/DELETE policies include both USING and WITH CHECK for updates. Composite `(plan_id,user_id)` foreign keys prevent cross-user parent references. Completion updates have restricted column grants. Anonymous roles have no table privileges. All RPCs that materialize schedules run as the invoker. The transport ledger and subscriptions intentionally have RLS and no browser policies: only the existing server service role can access them.

`supabase/tests/medication_rls.sql` and `workout_rls.sql` create synthetic users inside a rolled-back transaction, check owner operations, cross-user reads/writes/FKs, anonymous denial, idempotent materialization and preserved completion history after pause. Run with the SQL editor or psql using an administrative test connection. Never substitute real user IDs.

Supabase's schema-discovery advisor warns that authenticated roles can discover table names in GraphQL. This does not bypass owner RLS; SELECT grants are required for the existing client access pattern. The server-only transport tables intentionally trigger the “RLS enabled, no policy” informational notice. Existing password-protection and streak-function advisories are outside this change. See [Supabase's database advisor](https://supabase.com/docs/guides/database/database-linter) for their meanings.

## Next extensions

Future doctors, allergies or medical records should receive their own owner-scoped tables in a new reviewed migration, not overloaded routine/task fields or public document storage. Health data remains excluded from the proposed assistant tools. See `agent-architecture.md` for the confirmation boundary that must be implemented before enabling agent writes.
