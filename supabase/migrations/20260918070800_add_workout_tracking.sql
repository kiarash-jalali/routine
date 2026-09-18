create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  activity_type text not null check (char_length(trim(activity_type)) between 1 and 80),
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  exercises text not null default '' check (char_length(exercises)<=4000),
  days_of_week integer[] not null default '{1,3,5}' check (cardinality(days_of_week) between 1 and 7 and days_of_week <@ array[1,2,3,4,5,6,7] and array_position(days_of_week,null) is null),
  preferred_time time not null,
  timezone text not null default 'UTC',
  is_active boolean not null default true,
  reminders_enabled boolean not null default false,
  schedule_version integer not null default 1,
  effective_from timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id,user_id)
);
create index workout_plans_user_idx on public.workout_plans(user_id);
create function public.prepare_workout_plan() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'Invalid timezone'; end if;
  if tg_op='UPDATE' then
    new.updated_at:=now();
    if row(new.name,new.activity_type,new.duration_minutes,new.exercises,new.days_of_week,new.preferred_time,new.timezone,new.is_active)
      is distinct from row(old.name,old.activity_type,old.duration_minutes,old.exercises,old.days_of_week,old.preferred_time,old.timezone,old.is_active) then
      new.schedule_version:=old.schedule_version+1;new.effective_from:=now();
    end if;
  end if;
  return new;
end;
$$;
create trigger prepare_workout_plan before insert or update on public.workout_plans for each row execute function public.prepare_workout_plan();
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid,
  name text not null check (char_length(trim(name)) between 1 and 120),
  activity_type text not null check (char_length(trim(activity_type)) between 1 and 80),
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  exercises text not null default '' check (char_length(exercises)<=4000),
  scheduled_day date not null,
  scheduled_time time not null,
  scheduled_at timestamptz not null,
  timezone text not null,
  schedule_version integer not null default 1,
  completed_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key(workout_id,user_id) references public.workout_plans(id,user_id) on delete cascade,
  unique(workout_id,scheduled_day,scheduled_time)
);
create index workout_sessions_owner_date_idx on public.workout_sessions(user_id,scheduled_at desc);
create index workout_sessions_plan_idx on public.workout_sessions(workout_id,user_id);
create index workout_sessions_due_idx on public.workout_sessions(scheduled_at) where completed_at is null;
alter table public.workout_plans enable row level security;
alter table public.workout_sessions enable row level security;
create policy workout_plans_select on public.workout_plans for select to authenticated using((select auth.uid())=user_id);
create policy workout_plans_insert on public.workout_plans for insert to authenticated with check((select auth.uid())=user_id);
create policy workout_plans_update on public.workout_plans for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy workout_plans_delete on public.workout_plans for delete to authenticated using((select auth.uid())=user_id);
create policy workout_sessions_select on public.workout_sessions for select to authenticated using((select auth.uid())=user_id);
create policy workout_sessions_insert on public.workout_sessions for insert to authenticated with check((select auth.uid())=user_id);
create policy workout_sessions_update on public.workout_sessions for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy workout_sessions_delete on public.workout_sessions for delete to authenticated using((select auth.uid())=user_id and completed_at is null and scheduled_at>=now());
revoke all on public.workout_plans,public.workout_sessions from anon,authenticated;
grant select,insert,update,delete on public.workout_plans to authenticated;
grant select,insert,delete on public.workout_sessions to authenticated;
grant update(completed_at,duration_minutes,exercises) on public.workout_sessions to authenticated;
grant all on public.workout_plans,public.workout_sessions to service_role;
create function public.sync_workout_sessions() returns void language plpgsql security invoker set search_path='' as $$
begin
  delete from public.workout_sessions s using public.workout_plans p
    where s.workout_id=p.id and s.user_id=p.user_id and s.completed_at is null and s.scheduled_at>=now()
      and (not p.is_active or s.schedule_version<>p.schedule_version);
  insert into public.workout_sessions(user_id,workout_id,name,activity_type,duration_minutes,exercises,scheduled_day,scheduled_time,scheduled_at,timezone,schedule_version)
  select p.user_id,p.id,p.name,p.activity_type,p.duration_minutes,p.exercises,d.day::date,p.preferred_time,
    (d.day::date+p.preferred_time) at time zone p.timezone,p.timezone,p.schedule_version
  from public.workout_plans p cross join lateral generate_series(
    greatest((p.effective_from at time zone p.timezone)::date,(now() at time zone p.timezone)::date-30),
    (now() at time zone p.timezone)::date+1,interval '1 day') d(day)
  where p.is_active and extract(isodow from d.day)::integer=any(p.days_of_week)
    and (d.day::date+p.preferred_time) at time zone p.timezone>=p.effective_from
  on conflict(workout_id,scheduled_day,scheduled_time) do nothing;
end;
$$;
revoke all on function public.sync_workout_sessions() from public,anon;
grant execute on function public.sync_workout_sessions() to authenticated,service_role;
