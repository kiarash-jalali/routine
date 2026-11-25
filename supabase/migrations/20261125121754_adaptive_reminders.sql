-- S7b: adaptive reminders. Quiet mode is computed from push_deliveries; this
-- table only stores when a user asked to start counting again (Keep / Change time).
create table if not exists public.reminder_adaptations (
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('task','routine','health','workout','checkin','meal_plan','grocery')),
  counted_from timestamptz not null default now(),
  primary key (user_id, category)
);
alter table public.reminder_adaptations enable row level security;
revoke all on public.reminder_adaptations from public, anon, authenticated;
grant select, insert, update, delete on public.reminder_adaptations to authenticated;
grant all on public.reminder_adaptations to service_role;

drop policy if exists reminder_adaptations_select on public.reminder_adaptations;
create policy reminder_adaptations_select on public.reminder_adaptations for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists reminder_adaptations_insert on public.reminder_adaptations;
create policy reminder_adaptations_insert on public.reminder_adaptations for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists reminder_adaptations_update on public.reminder_adaptations;
create policy reminder_adaptations_update on public.reminder_adaptations for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists reminder_adaptations_delete on public.reminder_adaptations;
create policy reminder_adaptations_delete on public.reminder_adaptations for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Per user and reminder category: was anything opened on each of the newest
-- five local days with a delivered reminder (newest first)? Several pushes or
-- devices on one day count once. Today counts only once something was opened.
-- Service role only; returns no reminder content.
create or replace function public.reminder_recent_days(p_users uuid[], p_since timestamptz)
returns table (user_id uuid, category text, opened boolean[])
language sql stable security invoker set search_path = '' as $$
  with deliveries as (
    select s.user_id as uid, k.kind,
      (d.delivered_at at time zone p.timezone)::date as day,
      (now() at time zone p.timezone)::date as today,
      d.opened_at is not null as was_opened
    from public.push_subscriptions s
    join public.notification_preferences p on p.user_id = s.user_id
    join public.push_deliveries d on d.subscription_id = s.id
    cross join lateral (
      select case split_part(d.event_key, ':', 1)
        when 'checkin' then 'checkin'
        when 'checkin-missed' then 'checkin'
        when 'task' then 'task'
        when 'routine' then 'routine'
        when 'health' then 'health'
        when 'workout' then 'workout'
        when 'meal-plan' then 'meal_plan'
        when 'grocery' then 'grocery'
      end as kind
    ) k
    left join public.reminder_adaptations a on a.user_id = s.user_id and a.category = k.kind
    where s.user_id = any (p_users)
      and k.kind is not null
      and d.delivered_at >= greatest(p_since, a.counted_from)
  ), days as (
    select uid, kind, day, bool_or(was_opened) as was_opened,
      row_number() over (partition by uid, kind order by day desc) as position
    from deliveries
    group by uid, kind, day, today
    having day < today or bool_or(was_opened)
  )
  select uid, kind, array_agg(was_opened order by day desc)
  from days where position <= 5
  group by uid, kind;
$$;
revoke all on function public.reminder_recent_days(uuid[], timestamptz) from public, anon, authenticated;
grant execute on function public.reminder_recent_days(uuid[], timestamptz) to service_role;
