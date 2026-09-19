-- Daily progress vs finished check-in
--
-- Dashboard interactions may create/update today's progress without counting the
-- day as a finished check-in. Points, streaks, history and reminder suppression
-- now depend on completed_at rather than row existence.

alter table public.daily_checkins
  add column if not exists completed_at timestamptz;

drop trigger if exists award_daily_checkin_points on public.daily_checkins;
drop trigger if exists award_daily_checkin_points_insert on public.daily_checkins;
drop trigger if exists award_daily_checkin_points_finish on public.daily_checkins;

-- Every existing row represented a finished check-in before completed_at existed.
update public.daily_checkins
set completed_at = created_at
where completed_at is null;

create or replace function public.award_daily_checkin_points()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.completed_at is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.completed_at is not null then
    return new;
  end if;

  insert into public.point_transactions (user_id, amount, kind, day)
  values (new.user_id, 10, 'checkin_reward', new.day)
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function public.award_daily_checkin_points()
  from public, anon, authenticated;

create trigger award_daily_checkin_points_insert
  after insert on public.daily_checkins
  for each row
  when (new.completed_at is not null)
  execute function public.award_daily_checkin_points();

create trigger award_daily_checkin_points_finish
  after update of completed_at on public.daily_checkins
  for each row
  when (old.completed_at is null and new.completed_at is not null)
  execute function public.award_daily_checkin_points();

create or replace function public.set_daily_item_completion(
  p_day date,
  p_item_type text,
  p_item_id uuid,
  p_completed boolean
)
returns table (
  id uuid,
  user_id uuid,
  day date,
  completed_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_checkin_id uuid;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_day is null or p_item_id is null or p_completed is null then
    raise exception 'invalid_daily_item';
  end if;

  if p_item_type = 'task' then
    if not exists (
      select 1
      from public.tasks
      where tasks.id = p_item_id
        and tasks.user_id = current_user_id
    ) then
      raise exception 'daily_item_not_found';
    end if;
  elsif p_item_type = 'routine' then
    if not exists (
      select 1
      from public.routines
      where routines.id = p_item_id
        and routines.user_id = current_user_id
    ) then
      raise exception 'daily_item_not_found';
    end if;
  else
    raise exception 'invalid_daily_item_type';
  end if;

  insert into public.daily_checkins (user_id, day)
  values (current_user_id, p_day)
  on conflict (user_id, day)
  do update set updated_at = now()
  returning daily_checkins.id into current_checkin_id;

  insert into public.checkin_items (
    user_id,
    checkin_id,
    item_type,
    item_id,
    completed
  )
  values (
    current_user_id,
    current_checkin_id,
    p_item_type,
    p_item_id,
    p_completed
  )
  on conflict (checkin_id, item_type, item_id)
  do update set
    completed = excluded.completed,
    user_id = excluded.user_id;

  if p_item_type = 'task' then
    update public.tasks
    set is_done = p_completed
    where tasks.id = p_item_id
      and tasks.user_id = current_user_id;
  end if;

  return query
  select
    daily_checkins.id,
    daily_checkins.user_id,
    daily_checkins.day,
    daily_checkins.completed_at
  from public.daily_checkins
  where daily_checkins.id = current_checkin_id;
end;
$$;

revoke all on function public.set_daily_item_completion(date, text, uuid, boolean)
  from public, anon;
grant execute on function public.set_daily_item_completion(date, text, uuid, boolean)
  to authenticated;

create or replace function public.finish_daily_checkin(
  p_day date,
  p_items jsonb
)
returns table (
  id uuid,
  user_id uuid,
  day date,
  completed_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_checkin_id uuid;
  item record;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_day is null then
    raise exception 'invalid_checkin_day';
  end if;

  insert into public.daily_checkins (user_id, day)
  values (current_user_id, p_day)
  on conflict (user_id, day)
  do update set updated_at = now()
  returning daily_checkins.id into current_checkin_id;

  for item in
    select *
    from pg_catalog.jsonb_to_recordset(coalesce(p_items, '[]'::jsonb))
      as x(item_type text, item_id uuid, completed boolean)
  loop
    if item.item_id is null or item.completed is null then
      raise exception 'invalid_daily_item';
    end if;

    if item.item_type = 'task' then
      if not exists (
        select 1
        from public.tasks
        where tasks.id = item.item_id
          and tasks.user_id = current_user_id
      ) then
        raise exception 'daily_item_not_found';
      end if;
    elsif item.item_type = 'routine' then
      if not exists (
        select 1
        from public.routines
        where routines.id = item.item_id
          and routines.user_id = current_user_id
      ) then
        raise exception 'daily_item_not_found';
      end if;
    else
      raise exception 'invalid_daily_item_type';
    end if;

    insert into public.checkin_items (
      user_id,
      checkin_id,
      item_type,
      item_id,
      completed
    )
    values (
      current_user_id,
      current_checkin_id,
      item.item_type,
      item.item_id,
      item.completed
    )
    on conflict (checkin_id, item_type, item_id)
    do update set
      completed = excluded.completed,
      user_id = excluded.user_id;

    if item.item_type = 'task' then
      update public.tasks
      set is_done = item.completed
      where tasks.id = item.item_id
        and tasks.user_id = current_user_id;
    end if;
  end loop;

  update public.daily_checkins
  set completed_at = coalesce(daily_checkins.completed_at, now())
  where daily_checkins.id = current_checkin_id;

  return query
  select
    daily_checkins.id,
    daily_checkins.user_id,
    daily_checkins.day,
    daily_checkins.completed_at
  from public.daily_checkins
  where daily_checkins.id = current_checkin_id;
end;
$$;

revoke all on function public.finish_daily_checkin(date, jsonb)
  from public, anon;
grant execute on function public.finish_daily_checkin(date, jsonb)
  to authenticated;

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
      and completed_at is not null
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

revoke all on function public.get_rhythm_summary(date, integer)
  from public, anon;
grant execute on function public.get_rhythm_summary(date, integer)
  to authenticated;

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
    raise exception 'not_authenticated';
  end if;

  if target_day is null then
    raise exception 'repair_day_required';
  end if;

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

  if current_balance < 30 then
    raise exception 'insufficient_recovery_points';
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
