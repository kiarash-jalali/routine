-- Review fixes for nutrition roadmap S1 (food catalog) and S6 (structured workouts).
-- 1. Deleting a food no longer violates recipe_ingredients' "food or name" check.
-- 2. Removing an exercise or changing a plan's schedule no longer erases logged sets.
-- 3. Saving a plan's exercise list is one transactional RPC.
-- Personal data: ids only in logs/analytics; nothing here reaches push payloads.

-- 1. recipe_ingredients.food_id is "on delete set null", and a row must have a
-- food or a name. The set-null runs after the food row is gone, so copy the
-- food's names into nameless ingredient rows before the delete. The recipe then
-- keeps a named line instead of failing the delete (or losing the line).
-- Security invoker: a user can only delete their own foods, and only their own
-- ingredient rows can reference them. Cascades from auth.users run as the owner.
create or replace function public.keep_ingredient_names_on_food_delete() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  update public.recipe_ingredients
     set name_en = coalesce(name_en, old.name_en),
         name_fa = coalesce(name_fa, old.name_fa)
   where food_id = old.id
     and coalesce(name_en, name_fa) is null;
  return old;
end;
$$;
revoke all on function public.keep_ingredient_names_on_food_delete() from public, anon, authenticated;
drop trigger if exists foods_keep_ingredient_names on public.foods;
create trigger foods_keep_ingredient_names before delete on public.foods
  for each row execute function public.keep_ingredient_names_on_food_delete();

-- 2a. Exercises with logged sets are archived instead of deleted. The existing
-- (plan_id, user_id, position) index covers the app's reads.
alter table public.workout_plan_exercises add column if not exists archived_at timestamptz;

-- 2b. Set logs no longer cascade from their exercise: deleting a single exercise
-- that has logged sets fails instead of erasing history. Account deletion still
-- works because workout_set_logs.user_id cascades from auth.users directly.
alter table public.workout_set_logs
  drop constraint if exists workout_set_logs_exercise_id_user_id_fkey;
alter table public.workout_set_logs
  add constraint workout_set_logs_exercise_id_user_id_fkey
  foreign key (exercise_id, user_id) references public.workout_plan_exercises(id, user_id);

-- 2c. Deleting a whole plan is an explicit choice to remove its history. The
-- plan's exercise and session cascades fire in trigger-name order, so remove the
-- set logs first; otherwise the exercise FK check could run before the session
-- cascade removed them. Security invoker: RLS limits it to the caller's rows;
-- cascades from auth.users run as the owner.
create or replace function public.delete_plan_set_logs() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.workout_set_logs l
  using public.workout_plan_exercises e
  where e.plan_id = old.id and e.user_id = old.user_id
    and l.exercise_id = e.id and l.user_id = e.user_id;
  return old;
end;
$$;
revoke all on function public.delete_plan_set_logs() from public, anon, authenticated;
drop trigger if exists workout_plans_delete_set_logs on public.workout_plans;
create trigger workout_plans_delete_set_logs before delete on public.workout_plans
  for each row execute function public.delete_plan_set_logs();

-- 2d. Plan changes rebuild future uncompleted sessions, but never one that
-- already has logged sets. Same body as before plus the not-exists guard. Such
-- a kept session stays at its old day/time, next to any new-version session.
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
    and (not p.is_active or s.schedule_version <> p.schedule_version)
    and not exists (select 1 from public.workout_set_logs l where l.session_id = s.id);

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

-- 3. Replace a plan's active exercise list in one transaction. p_exercises is a
-- JSON array of {id?, name, target_sets, rep_scheme, rest_seconds, notes}; array
-- order is the position. Active exercises missing from the list are archived
-- when they have logged sets and deleted otherwise. Security invoker: RLS limits
-- every statement to the caller's rows; table checks validate the values.
create or replace function public.save_plan_exercises(p_plan_id uuid, p_exercises jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_item jsonb;
  v_index integer;
  v_id uuid;
begin
  if v_user is null or not exists (
    select 1 from public.workout_plans where id = p_plan_id and user_id = v_user
  ) then
    raise exception 'Workout plan not found' using errcode = '42501';
  end if;
  if p_exercises is null or jsonb_typeof(p_exercises) <> 'array' or jsonb_array_length(p_exercises) > 50 then
    raise exception 'Invalid exercise list' using errcode = '22023';
  end if;

  with keep as (
    select (item->>'id')::uuid as id
    from jsonb_array_elements(p_exercises) item
    where nullif(item->>'id', '') is not null
  ),
  removed as (
    select e.id from public.workout_plan_exercises e
    where e.plan_id = p_plan_id and e.user_id = v_user and e.archived_at is null
      and e.id not in (select id from keep)
  ),
  archived as (
    update public.workout_plan_exercises e set archived_at = now()
    where e.id in (select id from removed)
      and exists (select 1 from public.workout_set_logs l where l.exercise_id = e.id and l.user_id = v_user)
    returning e.id
  )
  delete from public.workout_plan_exercises e
  where e.id in (select id from removed)
    and e.user_id = v_user
    and e.id not in (select id from archived);

  for v_item, v_index in
    select item, (ord - 1)::integer from jsonb_array_elements(p_exercises) with ordinality as t(item, ord)
  loop
    v_id := nullif(v_item->>'id', '')::uuid;
    if v_id is null then
      insert into public.workout_plan_exercises
        (plan_id, user_id, position, name, target_sets, rep_scheme, rest_seconds, notes)
      values (
        p_plan_id, v_user, v_index,
        trim(coalesce(v_item->>'name', '')),
        coalesce((v_item->>'target_sets')::smallint, 3),
        trim(coalesce(v_item->>'rep_scheme', '')),
        (v_item->>'rest_seconds')::smallint,
        nullif(v_item->>'notes', '')
      );
    else
      update public.workout_plan_exercises set
        position = v_index,
        name = trim(coalesce(v_item->>'name', '')),
        target_sets = coalesce((v_item->>'target_sets')::smallint, 3),
        rep_scheme = trim(coalesce(v_item->>'rep_scheme', '')),
        rest_seconds = (v_item->>'rest_seconds')::smallint,
        notes = nullif(v_item->>'notes', '')
      where id = v_id and plan_id = p_plan_id and user_id = v_user and archived_at is null;
      if not found then
        raise exception 'Exercise not found' using errcode = '42501';
      end if;
    end if;
  end loop;
end;
$$;
revoke all on function public.save_plan_exercises(uuid, jsonb) from public, anon;
grant execute on function public.save_plan_exercises(uuid, jsonb) to authenticated, service_role;
