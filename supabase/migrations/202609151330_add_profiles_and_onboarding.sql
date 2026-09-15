-- Profiles + onboarding v1
--
-- Existing users are treated as already onboarded so this migration does not
-- interrupt people who were using Routine Helper before onboarding existed.
-- New auth users receive a profile automatically with onboarding incomplete.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (
    display_name is null or char_length(trim(display_name)) between 1 and 80
  ),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can read their profile" on public.profiles;
create policy "Users can read their profile"
  on public.profiles
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile"
  on public.profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke insert, delete on public.profiles from anon, authenticated;
grant select, update on public.profiles to authenticated;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, onboarding_completed)
  values (new.id, false)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists create_profile_after_signup on auth.users;
create trigger create_profile_after_signup
  after insert on auth.users
  for each row
  execute function public.create_profile_for_new_user();

-- Do not force existing alpha users through onboarding retroactively.
insert into public.profiles (user_id, onboarding_completed)
select id, true
from auth.users
on conflict (user_id) do nothing;
