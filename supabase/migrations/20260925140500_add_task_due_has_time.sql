alter table public.tasks
  add column if not exists due_has_time boolean not null default false;

comment on column public.tasks.due_has_time is
  'True only when the user explicitly selected a due time. Date-only tasks retain due_at for day grouping but do not trigger notifications.';
