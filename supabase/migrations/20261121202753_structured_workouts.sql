-- Nutrition roadmap S6: structured workout exercises and per-set logs.
-- Personal data: ids only in logs/analytics; push payloads keep generic copy.
-- workout_plans.exercises (free text) stays for existing plans.

-- Composite target for set logs (id is already the primary key, so this holds).
alter table public.workout_sessions
  add constraint workout_sessions_id_user_key unique (id, user_id);

create table public.workout_plan_exercises (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  position smallint not null default 0 check (position between 0 and 49),
  name text not null check (char_length(trim(name)) between 1 and 120),
  target_sets smallint not null default 3 check (target_sets between 1 and 20),
  rep_scheme text not null default '' check (char_length(rep_scheme) <= 40),
  rest_seconds smallint check (rest_seconds is null or rest_seconds between 0 and 900),
  notes text check (notes is null or char_length(notes) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (plan_id, user_id) references public.workout_plans(id, user_id) on delete cascade,
  unique (id, user_id)
);
create index workout_plan_exercises_plan_idx on public.workout_plan_exercises(plan_id, user_id, position);
create index workout_plan_exercises_user_idx on public.workout_plan_exercises(user_id);
create trigger workout_plan_exercises_set_updated_at before update on public.workout_plan_exercises
  for each row execute function public.set_updated_at();

create table public.workout_set_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  exercise_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  set_number smallint not null check (set_number between 1 and 20),
  reps smallint not null check (reps between 0 and 200),
  weight_kg numeric(5,1) check (weight_kg is null or weight_kg between 0 and 500),
  band_level text check (band_level is null or char_length(trim(band_level)) between 1 and 30),
  rpe numeric(3,1) check (rpe is null or rpe between 1 and 10),
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (session_id, user_id) references public.workout_sessions(id, user_id) on delete cascade,
  foreign key (exercise_id, user_id) references public.workout_plan_exercises(id, user_id) on delete cascade,
  unique (session_id, exercise_id, set_number)
);
create index workout_set_logs_session_idx on public.workout_set_logs(session_id, user_id);
create index workout_set_logs_exercise_idx on public.workout_set_logs(exercise_id, user_id);
create index workout_set_logs_user_idx on public.workout_set_logs(user_id);

alter table public.workout_plan_exercises enable row level security;
alter table public.workout_set_logs enable row level security;

create policy workout_plan_exercises_select on public.workout_plan_exercises for select to authenticated using ((select auth.uid()) = user_id);
create policy workout_plan_exercises_insert on public.workout_plan_exercises for insert to authenticated with check ((select auth.uid()) = user_id);
create policy workout_plan_exercises_update on public.workout_plan_exercises for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy workout_plan_exercises_delete on public.workout_plan_exercises for delete to authenticated using ((select auth.uid()) = user_id);

create policy workout_set_logs_select on public.workout_set_logs for select to authenticated using ((select auth.uid()) = user_id);
create policy workout_set_logs_insert on public.workout_set_logs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy workout_set_logs_update on public.workout_set_logs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy workout_set_logs_delete on public.workout_set_logs for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.workout_plan_exercises, public.workout_set_logs from anon, authenticated;
grant select, insert, update, delete on public.workout_plan_exercises, public.workout_set_logs to authenticated;
grant all on public.workout_plan_exercises, public.workout_set_logs to service_role;
