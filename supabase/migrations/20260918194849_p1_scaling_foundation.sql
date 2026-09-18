-- P1 production foundation: distributed rate limits, targeted schedule sync,
-- and a compact rhythm summary for the dashboard.

create table if not exists public.api_rate_limits (
  bucket text not null,
  subject_hash text not null,
  window_start timestamptz not null,
  hits integer not null default 1 check (hits > 0),
  primary key (bucket, subject_hash, window_start)
);

alter table public.api_rate_limits enable row level security;
revoke all on table public.api_rate_limits from public, anon, authenticated;
grant all on table public.api_rate_limits to service_role;

drop policy if exists api_rate_limits_server_only on public.api_rate_limits;
create policy api_rate_limits_server_only
  on public.api_rate_limits
  for all
  to anon, authenticated
  using (false)
  with check (false);

create or replace function public.consume_api_rate_limit(
  p_bucket text,
  p_subject_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window_start timestamptz;
  v_hits integer;
begin
  if p_bucket is null or length(p_bucket) = 0
     or p_subject_hash is null or length(p_subject_hash) = 0
     or p_limit < 1
     or p_window_seconds < 1 then
    raise exception 'invalid_rate_limit_arguments';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.api_rate_limits (bucket, subject_hash, window_start, hits)
  values (p_bucket, p_subject_hash, v_window_start, 1)
  on conflict (bucket, subject_hash, window_start)
  do update set hits = public.api_rate_limits.hits + 1
  returning hits into v_hits;

  delete from public.api_rate_limits
  where window_start < now() - interval '1 day';

  return v_hits <= p_limit;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, text, integer, integer)
  to service_role;

create index if not exists medication_reminders_plan_horizon_idx
  on public.medication_reminders (medication_id, schedule_version, scheduled_at desc);

create index if not exists workout_sessions_plan_horizon_idx
  on public.workout_sessions (workout_id, schedule_version, scheduled_at desc);

create or replace function public.sync_medication_reminders(target_user_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.medication_reminders r
  using public.medication_plans p
  where r.medication_id = p.id
    and r.user_id = p.user_id
    and (target_user_id is null or p.user_id = target_user_id)
    and r.taken_at is null
    and r.scheduled_at >= now()
    and (not p.is_active or r.schedule_version <> p.schedule_version);

  insert into public.medication_reminders
    (user_id, medication_id, scheduled_day, scheduled_time, scheduled_at, timezone, name, dose, schedule_version)
  select
    p.user_id, p.id, d.day::date, t.time,
    (d.day::date + t.time::time) at time zone p.timezone,
    p.timezone, p.name, p.dose, p.schedule_version
  from public.medication_plans p
  cross join lateral generate_series(
    greatest(
      (p.effective_from at time zone p.timezone)::date,
      coalesce(p.start_date, (now() at time zone p.timezone)::date - 2),
      (now() at time zone p.timezone)::date - 2
    ),
    least(
      (now() at time zone p.timezone)::date + 8,
      coalesce(p.end_date, (now() at time zone p.timezone)::date + 8)
    ),
    interval '1 day'
  ) d(day)
  cross join lateral unnest(p.times) t(time)
  where p.is_active
    and (
      (target_user_id is not null and p.user_id = target_user_id)
      or (
        target_user_id is null
        and (
          p.effective_from >= now() - interval '1 day'
          or not exists (
            select 1 from public.medication_reminders existing
            where existing.medication_id = p.id
              and existing.schedule_version = p.schedule_version
              and existing.scheduled_at > now() + interval '1 day'
          )
        )
      )
    )
    and extract(isodow from d.day)::integer = any(p.days_of_week)
    and (d.day::date + t.time::time) at time zone p.timezone >= p.effective_from
  on conflict (medication_id, scheduled_day, scheduled_time) do nothing;
end;
$$;

create or replace function public.sync_medication_reminders()
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform public.sync_medication_reminders(null);
end;
$$;

revoke all on function public.sync_medication_reminders(uuid) from public, anon;
revoke all on function public.sync_medication_reminders() from public, anon;
grant execute on function public.sync_medication_reminders(uuid) to authenticated, service_role;
grant execute on function public.sync_medication_reminders() to authenticated, service_role;

create or replace function public.sync_workout_sessions(target_user_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.workout_sessions s
  using public.workout_plans p
  where s.workout_id = p.id
    and s.user_id = p.user_id
    and (target_user_id is null or p.user_id = target_user_id)
    and s.completed_at is null
    and s.scheduled_at >= now()
    and (not p.is_active or s.schedule_version <> p.schedule_version);

  insert into public.workout_sessions
    (user_id, workout_id, name, activity_type, duration_minutes, exercises, scheduled_day, scheduled_time, scheduled_at, timezone, schedule_version)
  select
    p.user_id, p.id, p.name, p.activity_type, p.duration_minutes, p.exercises,
    d.day::date, p.preferred_time,
    (d.day::date + p.preferred_time) at time zone p.timezone,
    p.timezone, p.schedule_version
  from public.workout_plans p
  cross join lateral generate_series(
    greatest(
      (p.effective_from at time zone p.timezone)::date,
      (now() at time zone p.timezone)::date - 2
    ),
    (now() at time zone p.timezone)::date + 8,
    interval '1 day'
  ) d(day)
  where p.is_active
    and (
      (target_user_id is not null and p.user_id = target_user_id)
      or (
        target_user_id is null
        and (
          p.effective_from >= now() - interval '1 day'
          or not exists (
            select 1 from public.workout_sessions existing
            where existing.workout_id = p.id
              and existing.schedule_version = p.schedule_version
              and existing.scheduled_at > now() + interval '1 day'
          )
        )
      )
    )
    and extract(isodow from d.day)::integer = any(p.days_of_week)
    and (d.day::date + p.preferred_time) at time zone p.timezone >= p.effective_from
  on conflict (workout_id, scheduled_day, scheduled_time) do nothing;
end;
$$;

create or replace function public.sync_workout_sessions()
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform public.sync_workout_sessions(null);
end;
$$;

revoke all on function public.sync_workout_sessions(uuid) from public, anon;
revoke all on function public.sync_workout_sessions() from public, anon;
grant execute on function public.sync_workout_sessions(uuid) to authenticated, service_role;
grant execute on function public.sync_workout_sessions() to authenticated, service_role;

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
    select day from public.daily_checkins where user_id = (select auth.uid())
  ),
  repaired_days as (
    select day from public.streak_repairs where user_id = (select auth.uid())
  ),
  all_days as (
    select day from checkin_days
    union
    select day from repaired_days
  ),
  numbered as (
    select day, day - (row_number() over (order by day))::integer as grp
    from all_days
  ),
  runs as (
    select min(day) as starts, max(day) as ends, count(*)::integer as len
    from numbered group by grp
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
      select len from runs
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

revoke all on function public.get_rhythm_summary(date, integer) from public, anon;
grant execute on function public.get_rhythm_summary(date, integer) to authenticated;
