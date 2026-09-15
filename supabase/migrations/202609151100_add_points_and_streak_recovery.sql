-- Points + missed-day recovery v1
--
-- Rules:
--   * Finishing a daily check-in earns 10 points once for that calendar day.
--   * Editing an existing check-in does not award more points.
--   * Repairing one missed rhythm day costs 30 points.
--   * A repair restores streak continuity only. It does not create a fake check-in
--     or change historical routine/task completion data.

create table if not exists public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount <> 0),
  kind text not null check (kind in ('checkin_reward', 'streak_repair')),
  day date,
  created_at timestamptz not null default now()
);

create unique index if not exists point_transactions_user_kind_day_unique
  on public.point_transactions (user_id, kind, day)
  where day is not null;

create table if not exists public.streak_repairs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  cost_points integer not null default 30 check (cost_points > 0),
  created_at timestamptz not null default now(),
  unique (user_id, day)
);

alter table public.point_transactions enable row level security;
alter table public.streak_repairs enable row level security;

drop policy if exists "Users can read their point transactions" on public.point_transactions;
create policy "Users can read their point transactions"
  on public.point_transactions
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read their streak repairs" on public.streak_repairs;
create policy "Users can read their streak repairs"
  on public.streak_repairs
  for select
  using (auth.uid() = user_id);

revoke insert, update, delete on public.point_transactions from anon, authenticated;
revoke insert, update, delete on public.streak_repairs from anon, authenticated;
grant select on public.point_transactions to authenticated;
grant select on public.streak_repairs to authenticated;

create or replace function public.award_daily_checkin_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.point_transactions (user_id, amount, kind, day)
  values (new.user_id, 10, 'checkin_reward', new.day)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists award_daily_checkin_points on public.daily_checkins;
create trigger award_daily_checkin_points
  after insert on public.daily_checkins
  for each row
  execute function public.award_daily_checkin_points();

insert into public.point_transactions (user_id, amount, kind, day)
select user_id, 10, 'checkin_reward', day
from public.daily_checkins
on conflict do nothing;

create or replace function public.get_point_balance()
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(sum(amount), 0)::integer
  from public.point_transactions
  where user_id = auth.uid();
$$;

create or replace function public.repair_streak_day(target_day date)
returns integer
language plpgsql
security definer
set search_path = public
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

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 0));

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

revoke all on function public.get_point_balance() from public;
revoke all on function public.repair_streak_day(date) from public;
grant execute on function public.get_point_balance() to authenticated;
grant execute on function public.repair_streak_day(date) to authenticated;
