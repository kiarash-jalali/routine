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
| 20261121202409 | nutrition_catalog_schema | 20261121202409_nutrition_catalog_schema.sql |
| 20261121202753 | structured_workouts | 20261121202753_structured_workouts.sql |
| 20261121202801 | push_delivery_opened_at | 20261121202801_push_delivery_opened_at.sql |
| 20261121204046 | seed_food_catalog_foods_ingredients | 20261121204046_seed_food_catalog_foods_ingredients.sql |
| 20261121204436 | seed_food_catalog_foods_iran | 20261121204436_seed_food_catalog_foods_iran.sql |
| 20261121204704 | seed_food_catalog_foods_global | 20261121204704_seed_food_catalog_foods_global.sql |
| 20261121204915 | seed_food_catalog_recipes | 20261121204915_seed_food_catalog_recipes.sql |
| 20261121210723 | remove_personal_name_from_starter_recipes | 20261121210723_remove_personal_name_from_starter_recipes.sql |
| 20261122092219 | body_profile_and_log | 20261122092219_body_profile_and_log.sql |

The older points, profiles, and notification-reminder SQL files are also historical repository sources but are not represented as standalone entries in the current production migration history.

## Rule for new migrations

From 20260918184226 onward, add new migrations instead of editing old ones, and keep the repository filename aligned with the version recorded by production whenever the migration is applied through the connected Supabase tooling.

If the project later switches to the Supabase CLI migration workflow, reconcile the older history deliberately with Supabase's migration-repair workflow before running a blanket `db push`.

`20261121205000_seed_food_catalog_ingredients.sql` (starter recipe ingredients) was run by hand in the Supabase SQL editor on 2026-11-22, so it has no entry in the production migration history. It is idempotent; replaying it is safe.

`20261122120000_nutrition_review_fixes.sql` (S1/S6 review fixes: food-delete trigger, exercise archiving, set-log FK without cascade, plan-delete set-log trigger, `sync_workout_sessions` keeps sessions with logged sets, `save_plan_exercises` RPC) was run by hand in the Supabase SQL editor on 2026-11-22, so it has no entry in the production migration history. It is idempotent; replaying it is safe. `src/types/database.ts` matches the regenerated types.
