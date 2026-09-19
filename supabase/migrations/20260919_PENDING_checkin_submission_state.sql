-- Draft daily completion state.
--
-- Dashboard completion can create/update today's row without claiming that the
-- user has finished a daily check-in. Existing rows predate draft support and
-- therefore represent submitted check-ins.

alter table public.daily_checkins
  add column if not exists submitted_at timestamptz;

update public.daily_checkins
set submitted_at = created_at
where submitted_at is null;

create index if not exists daily_checkins_submitted_user_day_idx
  on public.daily_checkins (user_id, day)
  where submitted_at is not null;

create or replace function public.award_daily_checkin_points()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.submitted_at is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.submitted_at is not null then
    return new;
  end if;

  insert into public.point_transactions (user_id, amount, kind, day)
  values (new.user_id, 10, 'checkin_reward', new.day)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists award_daily_checkin_points on public.daily_checkins;
create trigger award_daily_checkin_points
  after insert or update of submitted_at on public.daily_checkins
  for each row
  execute function public.award_daily_checkin_points();

create or replace function public.get_rhythm_summary(
  p_today date,
  p_window_days integer default 7
)
returns table (
  current_days integer,
  best_days integer,
  checked_in_today boolean,
  recent_checkin_days date[],
  recent_repaired_days date[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select greatest(1, least(coalesce(p_window_days, 7), 90))::integer as window_days
  ),
  checkin_days as (
    select day
    from public.daily_checkins
    where user_id = (select auth.uid())
      and submitted_at is not null
  ),
  repaired_days as (
    select day
    from public.streak_repairs
    where user_id = (select auth.uid())
  ),
  all_days as (
    select day from checkin_days
    union
    select day from repaired_days
  ),
  numbered as (
    select
      day,
      day - (row_number() over (order by day))::integer as grp
    from all_days
  ),
  runs as (
    select min(day) as starts, max(day) as ends, count(*)::integer as len
    from numbered
    group by grp
  ),
  anchor as (
    select case
      when exists (select 1 from all_days where day = p_today) then p_today
      when exists (select 1 from all_days where day = p_today - 1) then p_today - 1
      else null::date
    end as day
  )
  select
    coalesce((
      select len
      from runs
      where (select day from anchor) between starts and ends
      limit 1
    ), 0)::integer,
    coalesce((select max(len) from runs), 0)::integer,
    exists (select 1 from checkin_days where day = p_today),
    coalesce((
      select array_agg(day order by day)
      from checkin_days, params
      where day between p_today - (params.window_days - 1) and p_today
    ), '{}'::date[]),
    coalesce((
      select array_agg(day order by day)
      from repaired_days, params
      where day between p_today - (params.window_days - 1) and p_today
    ), '{}'::date[]);
$$;

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
    where user_id = current_user_id
      and day = target_day
      and submitted_at is not null
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
    where user_id = current_user_id
      and day < target_day
      and submitted_at is not null
  ) or not exists (
    select 1
    from public.daily_checkins
    where user_id = current_user_id
      and day > target_day
      and submitted_at is not null
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

revoke all on function public.get_rhythm_summary(date, integer)
  from public, anon;
grant execute on function public.get_rhythm_summary(date, integer)
  to authenticated;

revoke all on function public.repair_streak_day(date)
  from public, anon;
grant execute on function public.repair_streak_day(date)
  to authenticated;
