alter table public.notification_preferences
  add column if not exists prompt_seen boolean not null default false,
  add column if not exists task_enabled boolean not null default true,
  add column if not exists routine_enabled boolean not null default true,
  add column if not exists health_enabled boolean not null default true,
  add column if not exists workout_enabled boolean not null default true,
  add column if not exists checkin_enabled boolean not null default true;

update public.notification_preferences
set prompt_seen = true
where prompt_seen = false;

insert into public.notification_preferences (
  user_id,
  enabled,
  reminder_time,
  timezone,
  prompt_seen,
  task_enabled,
  routine_enabled,
  health_enabled,
  workout_enabled,
  checkin_enabled
)
select
  p.user_id,
  false,
  '20:00',
  'UTC',
  true,
  true,
  true,
  true,
  true,
  true
from public.profiles p
where p.onboarding_completed
  and not exists (
    select 1
    from public.notification_preferences n
    where n.user_id = p.user_id
  );
