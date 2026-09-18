-- Make the server-only push tables explicit and harden the signed-in streak-repair RPC.
--
-- push_subscriptions and push_deliveries are intentionally managed only through
-- trusted server routes using the service-role client. Browser roles have no
-- table grants; the deny-all policies below make that intent explicit while
-- preserving service-role access (service_role bypasses RLS).
--
-- repair_streak_day remains SECURITY DEFINER because authenticated clients are
-- intentionally not allowed to write point_transactions or streak_repairs
-- directly. The function uses an empty search_path and fully-qualified objects.

drop policy if exists push_subscriptions_server_only on public.push_subscriptions;
create policy push_subscriptions_server_only
  on public.push_subscriptions
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists push_deliveries_server_only on public.push_deliveries;
create policy push_deliveries_server_only
  on public.push_deliveries
  for all
  to anon, authenticated
  using (false)
  with check (false);

comment on table public.push_subscriptions is
  'Server-managed Web Push subscriptions. Browser roles intentionally have no direct table grants.';

comment on table public.push_deliveries is
  'Server-managed Web Push delivery log. Browser roles intentionally have no direct table grants.';

create or replace function public.repair_streak_day(target_day date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_balance integer;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to repair a rhythm day.';
  end if;

  if target_day is null then
    raise exception 'A repair day is required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 0)
  );

  if exists (
    select 1
    from public.daily_checkins
    where user_id = current_user_id and day = target_day
  ) then
    raise exception 'That day already has a real check-in.';
  end if;

  if exists (
    select 1
    from public.streak_repairs
    where user_id = current_user_id and day = target_day
  ) then
    raise exception 'That day has already been repaired.';
  end if;

  if not exists (
    select 1
    from public.daily_checkins
    where user_id = current_user_id and day < target_day
  ) or not exists (
    select 1
    from public.daily_checkins
    where user_id = current_user_id and day > target_day
  ) then
    raise exception 'Only a missed day between two real check-ins can be repaired.';
  end if;

  select coalesce(sum(amount), 0)::integer
  into current_balance
  from public.point_transactions
  where user_id = current_user_id;

  if current_balance < 30 then
    raise exception 'You need 30 recovery points to repair this day.';
  end if;

  insert into public.streak_repairs (user_id, day, cost_points)
  values (current_user_id, target_day, 30);

  insert into public.point_transactions (user_id, amount, kind, day)
  values (current_user_id, -30, 'streak_repair', target_day);

  return current_balance - 30;
end;
$$;

revoke all on function public.repair_streak_day(date) from public, anon;
grant execute on function public.repair_streak_day(date) to authenticated;

comment on function public.repair_streak_day(date) is
  'Authenticated streak-repair RPC. SECURITY DEFINER is intentional; direct writes to points/repairs remain revoked.';
