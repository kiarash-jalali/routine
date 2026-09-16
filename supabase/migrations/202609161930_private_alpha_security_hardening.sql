-- Private-alpha database hardening
--
-- Goals:
--   * remove all anonymous table access;
--   * keep only the browser privileges Routine actually uses;
--   * restrict SECURITY DEFINER functions to their intended callers;
--   * make RLS policies explicit to authenticated users and avoid per-row
--     auth.uid() re-evaluation by wrapping it in a scalar subquery.

-- Anonymous users never need direct access to application tables. Authentication
-- itself is handled by Supabase Auth, not these public tables.
revoke all on table public.tasks from anon;
revoke all on table public.routines from anon;
revoke all on table public.daily_checkins from anon;
revoke all on table public.checkin_items from anon;
revoke all on table public.profiles from anon;
revoke all on table public.point_transactions from anon;
revoke all on table public.streak_repairs from anon;
revoke all on table public.notification_preferences from anon;
revoke all on table public.push_subscriptions from anon;

-- Start from a narrow authenticated privilege set and grant back only what the
-- browser app needs. Server routes use the Supabase secret/service-role key.
revoke all on table public.tasks from authenticated;
revoke all on table public.routines from authenticated;
revoke all on table public.daily_checkins from authenticated;
revoke all on table public.checkin_items from authenticated;
revoke all on table public.profiles from authenticated;
revoke all on table public.point_transactions from authenticated;
revoke all on table public.streak_repairs from authenticated;
revoke all on table public.notification_preferences from authenticated;
revoke all on table public.push_subscriptions from authenticated;

grant select, insert, update, delete on table public.tasks to authenticated;
grant select, insert, update, delete on table public.routines to authenticated;
grant select, insert, update, delete on table public.daily_checkins to authenticated;
grant select, insert, update, delete on table public.checkin_items to authenticated;
grant select, update on table public.profiles to authenticated;
grant select on table public.point_transactions to authenticated;
grant select on table public.streak_repairs to authenticated;
grant select, insert, update on table public.notification_preferences to authenticated;
-- push_subscriptions intentionally has no browser grants. It is managed only by
-- the authenticated server API so a device endpoint can be safely reassigned
-- when a different account uses the same installed PWA.

-- Core user-owned tables -------------------------------------------------------
drop policy if exists tasks_select_own on public.tasks;
create policy tasks_select_own on public.tasks
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists tasks_insert_own on public.tasks;
create policy tasks_insert_own on public.tasks
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists tasks_update_own on public.tasks;
create policy tasks_update_own on public.tasks
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists tasks_delete_own on public.tasks;
create policy tasks_delete_own on public.tasks
  for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists routines_select_own on public.routines;
create policy routines_select_own on public.routines
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists routines_insert_own on public.routines;
create policy routines_insert_own on public.routines
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists routines_update_own on public.routines;
create policy routines_update_own on public.routines
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists routines_delete_own on public.routines;
create policy routines_delete_own on public.routines
  for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists daily_checkins_select_own on public.daily_checkins;
create policy daily_checkins_select_own on public.daily_checkins
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists daily_checkins_insert_own on public.daily_checkins;
create policy daily_checkins_insert_own on public.daily_checkins
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists daily_checkins_update_own on public.daily_checkins;
create policy daily_checkins_update_own on public.daily_checkins
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists daily_checkins_delete_own on public.daily_checkins;
create policy daily_checkins_delete_own on public.daily_checkins
  for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists checkin_items_select_own on public.checkin_items;
create policy checkin_items_select_own on public.checkin_items
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists checkin_items_insert_own on public.checkin_items;
create policy checkin_items_insert_own on public.checkin_items
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists checkin_items_update_own on public.checkin_items;
create policy checkin_items_update_own on public.checkin_items
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists checkin_items_delete_own on public.checkin_items;
create policy checkin_items_delete_own on public.checkin_items
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Read-only points / recovery data --------------------------------------------
drop policy if exists "Users can read their point transactions" on public.point_transactions;
create policy "Users can read their point transactions"
  on public.point_transactions
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their streak repairs" on public.streak_repairs;
create policy "Users can read their streak repairs"
  on public.streak_repairs
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Profile ---------------------------------------------------------------------
drop policy if exists "Users can read their profile" on public.profiles;
create policy "Users can read their profile"
  on public.profiles
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile"
  on public.profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Notification preferences remain client-managed, but push subscriptions are
-- server-managed only.
drop policy if exists "Users can read own notification preferences" on public.notification_preferences;
create policy "Users can read own notification preferences"
  on public.notification_preferences
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own notification preferences" on public.notification_preferences;
create policy "Users can insert own notification preferences"
  on public.notification_preferences
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own notification preferences" on public.notification_preferences;
create policy "Users can update own notification preferences"
  on public.notification_preferences
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can insert own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can update own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can delete own push subscriptions" on public.push_subscriptions;

-- Functions -------------------------------------------------------------------
-- Trigger helpers should never be callable through the public API.
revoke execute on function public.award_daily_checkin_points() from public, anon, authenticated;
revoke execute on function public.create_profile_for_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- Points RPCs are available only to signed-in users. repair_streak_day remains
-- SECURITY DEFINER because browsers are intentionally not allowed to insert point
-- transactions or repair rows directly.
revoke execute on function public.get_point_balance() from public, anon, authenticated;
revoke execute on function public.repair_streak_day(date) from public, anon, authenticated;
grant execute on function public.get_point_balance() to authenticated;
grant execute on function public.repair_streak_day(date) to authenticated;
