-- Centralize the points economy so product values have one database source of truth.
-- The rules row is readable by signed-in clients, but only migrations/admin code can edit it.

create table if not exists public.point_rules (
  id text primary key check (id = 'default'),
  checkin_reward_points integer not null check (checkin_reward_points > 0),
  streak_repair_cost_points integer not null check (streak_repair_cost_points > 0),
  updated_at timestamptz not null default now()
);

insert into public.point_rules (
  id,
  checkin_reward_points,
  streak_repair_cost_points
)
values ('default', 10, 30)
on conflict (id) do nothing;

alter table public.point_rules enable row level security;

drop policy if exists "Authenticated users can read point rules"
  on public.point_rules;
create policy "Authenticated users can read point rules"
  on public.point_rules
  for select
  to authenticated
  using (id = 'default');

revoke all on table public.point_rules from public, anon, authenticated;
grant select on table public.point_rules to authenticated;

alter table public.streak_repairs
  alter column cost_points drop default;

create or replace function public.get_point_rules()
returns table (
  checkin_reward_points integer,
  streak_repair_cost_points integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    point_rules.checkin_reward_points,
    point_rules.streak_repair_cost_points
  from public.point_rules
  where point_rules.id = 'default'
$$;

revoke execute on function public.get_point_rules() from public, anon;
grant execute on function public.get_point_rules() to authenticated;

create or replace function public.award_daily_checkin_points()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reward_points integer;
begin
  if new.completed_at is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.completed_at is not null then
    return new;
  end if;

  select point_rules.checkin_reward_points
  into strict reward_points
  from public.point_rules
  where point_rules.id = 'default';

  insert into public.point_transactions (user_id, amount, kind, day)
  values (new.user_id, reward_points, 'checkin_reward', new.day)
  on conflict do nothing;

  return new;
end;
$$;

revoke execute on function public.award_daily_checkin_points()
  from public, anon, authenticated;

create or replace function public.repair_streak_day(target_day date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_balance integer;
  repair_cost integer;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if target_day is null then
    raise exception 'repair_day_required';
  end if;

  select point_rules.streak_repair_cost_points
  into strict repair_cost
  from public.point_rules
  where point_rules.id = 'default';

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 0)
  );

  if exists (
    select 1
    from public.daily_checkins
    where user_id = current_user_id
      and day = target_day
      and completed_at is not null
  ) then
    raise exception 'day_already_checked_in';
  end if;

  if exists (
    select 1
    from public.streak_repairs
    where user_id = current_user_id
      and day = target_day
  ) then
    raise exception 'day_already_repaired';
  end if;

  if not exists (
    select 1
    from public.daily_checkins
    where user_id = current_user_id
      and day < target_day
      and completed_at is not null
  ) or not exists (
    select 1
    from public.daily_checkins
    where user_id = current_user_id
      and day > target_day
      and completed_at is not null
  ) then
    raise exception 'repair_requires_neighboring_checkins';
  end if;

  select coalesce(sum(amount), 0)::integer
  into current_balance
  from public.point_transactions
  where user_id = current_user_id;

  if current_balance < repair_cost then
    raise exception 'insufficient_recovery_points';
  end if;

  insert into public.streak_repairs (user_id, day, cost_points)
  values (current_user_id, target_day, repair_cost);

  insert into public.point_transactions (user_id, amount, kind, day)
  values (current_user_id, -repair_cost, 'streak_repair', target_day);

  return current_balance - repair_cost;
end;
$$;

revoke execute on function public.repair_streak_day(date) from public, anon;
grant execute on function public.repair_streak_day(date) to authenticated;
