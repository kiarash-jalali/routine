-- Bootstrap baseline for the four core tables that predate migration discipline.
--
-- This file intentionally sorts before every historical migration. It is for
-- building a fresh Supabase database from the repository. Production already
-- contains these objects, so do not apply this file retroactively to the live
-- project; see supabase/MIGRATIONS.md before using db push against production.

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  notes text,
  due_at timestamptz,
  is_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_id_idx
  on public.tasks (user_id);
create index if not exists tasks_due_at_idx
  on public.tasks (due_at);

create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  frequency text not null check (frequency in ('daily', 'weekly')),
  days_of_week integer[],
  preferred_time time,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists routines_user_id_idx
  on public.routines (user_id);
create index if not exists routines_active_idx
  on public.routines (is_active);

create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  mood smallint,
  energy smallint,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);

create index if not exists daily_checkins_user_day_idx
  on public.daily_checkins (user_id, day);

create table if not exists public.checkin_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  checkin_id uuid not null references public.daily_checkins(id) on delete cascade,
  item_type text not null check (item_type in ('task', 'routine')),
  item_id uuid not null,
  completed boolean not null default true,
  created_at timestamptz not null default now(),
  unique (checkin_id, item_type, item_id)
);

create index if not exists checkin_items_checkin_idx
  on public.checkin_items (checkin_id);
create index if not exists checkin_items_user_idx
  on public.checkin_items (user_id);

alter table public.tasks enable row level security;
alter table public.routines enable row level security;
alter table public.daily_checkins enable row level security;
alter table public.checkin_items enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

drop trigger if exists set_routines_updated_at on public.routines;
create trigger set_routines_updated_at
  before update on public.routines
  for each row execute function public.set_updated_at();

drop trigger if exists set_daily_checkins_updated_at on public.daily_checkins;
create trigger set_daily_checkins_updated_at
  before update on public.daily_checkins
  for each row execute function public.set_updated_at();

-- Ownership policies and browser grants are deliberately defined by the later
-- private_alpha_security_hardening migration, so a fresh replay reaches the same
-- security model as production instead of maintaining two policy definitions.
