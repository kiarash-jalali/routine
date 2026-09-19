# Supabase migration history

The production database predates a fully synchronized local migration workflow, so several historical SQL filenames in this repository do not match the migration version recorded by Supabase.

Do not rename or rewrite the historical migration files just to make the timestamps match. They are useful as source history, and changing them after production has already been migrated can make future reconciliation harder.

## Fresh-database bootstrap

`00000000000000_initial_core_schema.sql` is a bootstrap snapshot of the live core tables (`tasks`, `routines`, `daily_checkins`, and `checkin_items`) and their indexes/update triggers. Those tables predate the migration history, so the bootstrap intentionally sorts first and makes a new database replayable.

The bootstrap is **not** a migration to apply retroactively to the existing production database. Before using Supabase CLI `db push` against production, reconcile the historical versions with Supabase's migration-repair workflow. For a fresh local or staging database, replay the repository migrations from the beginning.

## Production-recorded migrations

| Supabase version | Migration name | Repository file |
| --- | --- | --- |
| 20260916154458 | private_alpha_security_hardening | 202609161930_private_alpha_security_hardening.sql |
| 20260916162337 | add_private_alpha_feedback | 202609162005_add_private_alpha_feedback.sql |
| 20260916162728 | index_feedback_user | 202609162030_index_feedback_user.sql |
| 20260918065326 | add_locale_and_intro_preferences | 20260918064955_add_locale_and_intro_preferences.sql |
| 20260918065723 | add_reminder_onboarding | 20260918065509_add_reminder_onboarding.sql |
| 20260918070704 | add_medication_tracking | 20260918065742_add_medication_tracking.sql |
| 20260918071145 | add_workout_tracking | 20260918070800_add_workout_tracking.sql |
| 20260918184226 | server_only_push_and_streak_hardening | 20260918184226_server_only_push_and_streak_hardening.sql |
| 20260918194849 | p1_scaling_foundation | 20260918194849_p1_scaling_foundation.sql |
| 20260919075812 | daily_progress_completion | 20260919075812_daily_progress_completion.sql |
| 20260919080029 | fix_daily_progress_conflict_target | 20260919080029_fix_daily_progress_conflict_target.sql |

The older points, profiles, and notification-reminder SQL files are also historical repository sources but are not represented as standalone entries in the current production migration history.

## Rule for new migrations

From 20260918184226 onward, add new migrations instead of editing old ones, and keep the repository filename aligned with the version recorded by production whenever the migration is applied through the connected Supabase tooling.

If the project later switches to the Supabase CLI migration workflow, reconcile the older history deliberately with Supabase's migration-repair workflow before running a blanket `db push`.
