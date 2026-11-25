-- S7c: weekly review. Health class (docs/nutrition-roadmap.md §3): never in push
-- payloads, logs, the offline snapshot or the agent snapshot.

-- One accepted suggestion per reviewed week, so a double tap can't apply twice.
alter table public.target_adjustments add column if not exists review_week date;
create unique index if not exists target_adjustments_review_week_key
  on public.target_adjustments(user_id, review_week) where review_week is not null;

create table if not exists public.review_dismissals (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, week_start)
);
alter table public.review_dismissals enable row level security;
revoke all on public.review_dismissals from public, anon, authenticated;
grant select, insert, update, delete on public.review_dismissals to authenticated;
grant all on public.review_dismissals to service_role;

drop policy if exists review_dismissals_select on public.review_dismissals;
create policy review_dismissals_select on public.review_dismissals for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists review_dismissals_insert on public.review_dismissals;
create policy review_dismissals_insert on public.review_dismissals for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists review_dismissals_update on public.review_dismissals;
create policy review_dismissals_update on public.review_dismissals for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists review_dismissals_delete on public.review_dismissals;
create policy review_dismissals_delete on public.review_dismissals for delete to authenticated
  using ((select auth.uid()) = user_id);
