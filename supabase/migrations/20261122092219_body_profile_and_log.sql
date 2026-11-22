-- Nutrition roadmap S2: body profile, body measurements and (for S7c) accepted
-- calorie target adjustments.
-- HEALTH DATA: never in push payloads, logs, analytics, the offline snapshot or
-- the planning-agent snapshot. Included in account export; deleted with the
-- account through the auth.users cascade.

create table public.body_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sex text check (sex in ('male', 'female')),
  birth_year int not null check (birth_year between 1900 and 2100),
  height_cm numeric(5,1) not null check (height_cm between 100 and 250),
  activity_level text not null default 'light'
    check (activity_level in ('sedentary', 'light', 'moderate', 'very_active')),
  goal_mode text not null default 'maintain'
    check (goal_mode in ('lose', 'maintain', 'gain')),
  goal_weight_kg numeric(5,1)
    check (goal_weight_kg is null or goal_weight_kg between 20 and 400),
  goal_rate_kg_week numeric(3,2) check (
    goal_rate_kg_week is null
    or (goal_mode = 'lose' and goal_rate_kg_week in (0.25, 0.5, 0.75, 1.0))
    or (goal_mode = 'gain' and goal_rate_kg_week in (0.25, 0.5))
  ),
  kcal_target_override int
    check (kcal_target_override is null or kcal_target_override between 800 and 6000),
  protein_mode text not null default 'auto'
    check (protein_mode in ('auto', 'limit', 'custom')),
  protein_grams int check (protein_grams is null or protein_grams between 10 and 400),
  week_starts_on smallint not null default 6 check (week_starts_on between 0 and 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint body_profiles_protein_grams_required
    check (protein_mode = 'auto' or protein_grams is not null)
);
create trigger body_profiles_set_updated_at before update on public.body_profiles
  for each row execute function public.set_updated_at();

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_on date not null,
  weight_kg numeric(5,2) check (weight_kg is null or weight_kg between 20 and 400),
  waist_cm numeric(5,1) check (waist_cm is null or waist_cm between 40 and 250),
  body_fat_pct numeric(4,1) check (body_fat_pct is null or body_fat_pct between 2 and 75),
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Also the index for the app's (user_id, measured_on) filter and order.
  constraint body_measurements_user_day_key unique (user_id, measured_on),
  constraint body_measurements_value_required
    check (weight_kg is not null or waist_cm is not null or body_fat_pct is not null)
);
create trigger body_measurements_set_updated_at before update on public.body_measurements
  for each row execute function public.set_updated_at();

-- Written by the weekly review (S7c); created here with the body tables.
create table public.target_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  effective_from date not null,
  delta_kcal int not null check (delta_kcal between -1000 and 1000 and delta_kcal <> 0),
  reason text not null default '' check (char_length(reason) <= 200),
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index target_adjustments_user_idx
  on public.target_adjustments(user_id, effective_from);

alter table public.body_profiles enable row level security;
alter table public.body_measurements enable row level security;
alter table public.target_adjustments enable row level security;

create policy body_profiles_select on public.body_profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy body_profiles_insert on public.body_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy body_profiles_update on public.body_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy body_profiles_delete on public.body_profiles for delete to authenticated using ((select auth.uid()) = user_id);

create policy body_measurements_select on public.body_measurements for select to authenticated using ((select auth.uid()) = user_id);
create policy body_measurements_insert on public.body_measurements for insert to authenticated with check ((select auth.uid()) = user_id);
create policy body_measurements_update on public.body_measurements for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy body_measurements_delete on public.body_measurements for delete to authenticated using ((select auth.uid()) = user_id);

create policy target_adjustments_select on public.target_adjustments for select to authenticated using ((select auth.uid()) = user_id);
create policy target_adjustments_insert on public.target_adjustments for insert to authenticated with check ((select auth.uid()) = user_id);
create policy target_adjustments_update on public.target_adjustments for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy target_adjustments_delete on public.target_adjustments for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.body_profiles, public.body_measurements, public.target_adjustments from anon, authenticated;
grant select, insert, update, delete on public.body_profiles, public.body_measurements, public.target_adjustments to authenticated;
grant all on public.body_profiles, public.body_measurements, public.target_adjustments to service_role;
