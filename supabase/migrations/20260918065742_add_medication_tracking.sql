-- Medication tracking stores user-entered information only. No clinical inference.
create function public.valid_schedule_times(value text[]) returns boolean
language sql immutable strict set search_path = '' as $$
  select cardinality(value) between 1 and 12
    and not exists (select 1 from unnest(value) t where t is null or t !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
    and cardinality(value) = (select count(distinct t) from unnest(value) t);
$$;
create table public.medication_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  dose text not null default '' check (char_length(dose) <= 120),
  notes text not null default '' check (char_length(notes) <= 2000),
  times text[] not null check (public.valid_schedule_times(times)),
  days_of_week integer[] not null default '{1,2,3,4,5,6,7}'
    check (cardinality(days_of_week) between 1 and 7 and days_of_week <@ array[1,2,3,4,5,6,7] and array_position(days_of_week,null) is null),
  timezone text not null default 'UTC',
  is_active boolean not null default true,
  reminders_enabled boolean not null default false,
  start_date date,
  end_date date,
  schedule_version integer not null default 1,
  effective_from timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index medication_plans_user_id_idx on public.medication_plans(user_id);
create function public.prepare_medication_plan() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'Invalid timezone';
  end if;
  if tg_op = 'UPDATE' then
    new.updated_at := now();
    if row(new.name,new.dose,new.times,new.days_of_week,new.timezone,new.start_date,new.end_date,new.is_active)
      is distinct from row(old.name,old.dose,old.times,old.days_of_week,old.timezone,old.start_date,old.end_date,old.is_active) then
      new.schedule_version := old.schedule_version + 1;
      new.effective_from := now();
    end if;
  end if;
  return new;
end;
$$;
create trigger prepare_medication_plan before insert or update on public.medication_plans
  for each row execute function public.prepare_medication_plan();
create table public.medication_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  medication_id uuid not null,
  scheduled_day date not null,
  scheduled_time text not null check (scheduled_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  scheduled_at timestamptz not null,
  timezone text not null,
  name text not null,
  dose text not null,
  schedule_version integer not null,
  taken_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (medication_id,user_id) references public.medication_plans(id,user_id) on delete cascade,
  unique (medication_id,scheduled_day,scheduled_time)
);
create index medication_reminders_user_date_idx on public.medication_reminders(user_id,scheduled_at desc);
create index medication_reminders_due_idx on public.medication_reminders(scheduled_at) where taken_at is null;
-- Composite FK and owner checks prevent connecting a record to another user's plan.
alter table public.medication_plans enable row level security;
alter table public.medication_reminders enable row level security;
create policy medication_plans_select on public.medication_plans for select to authenticated using ((select auth.uid()) = user_id);
create policy medication_plans_insert on public.medication_plans for insert to authenticated with check ((select auth.uid()) = user_id);
create policy medication_plans_update on public.medication_plans for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy medication_plans_delete on public.medication_plans for delete to authenticated using ((select auth.uid()) = user_id);
create policy medication_reminders_select on public.medication_reminders for select to authenticated using ((select auth.uid()) = user_id);
create policy medication_reminders_insert on public.medication_reminders for insert to authenticated with check ((select auth.uid()) = user_id);
create policy medication_reminders_update on public.medication_reminders for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy medication_reminders_delete on public.medication_reminders for delete to authenticated using ((select auth.uid()) = user_id and taken_at is null and scheduled_at >= now());
revoke all on public.medication_plans, public.medication_reminders from anon, authenticated;
grant select, insert, update, delete on public.medication_plans to authenticated;
grant select, insert, delete on public.medication_reminders to authenticated;
grant update (taken_at) on public.medication_reminders to authenticated;
grant all on public.medication_plans, public.medication_reminders to service_role;
-- Invoker RLS limits app calls to the caller. The existing server scheduler uses service_role.
create function public.sync_medication_reminders() returns void
language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.medication_reminders r using public.medication_plans p
    where r.medication_id=p.id and r.user_id=p.user_id and r.taken_at is null and r.scheduled_at >= now()
    and (not p.is_active or r.schedule_version <> p.schedule_version);
  insert into public.medication_reminders
    (user_id, medication_id,scheduled_day,scheduled_time,scheduled_at,timezone,name,dose,schedule_version)
  select p.user_id,p.id,d.day::date,t.time,(d.day::date + t.time::time) at time zone p.timezone,p.timezone,p.name,p.dose,p.schedule_version
  from public.medication_plans p
  cross join lateral generate_series(
    greatest((p.effective_from at time zone p.timezone)::date,coalesce(p.start_date,(now() at time zone p.timezone)::date-30),(now() at time zone p.timezone)::date-30),
    least((now() at time zone p.timezone)::date+1,coalesce(p.end_date,(now() at time zone p.timezone)::date+1)), interval '1 day') d(day)
  cross join lateral unnest(p.times) t(time)
  where p.is_active and extract(isodow from d.day)::integer = any(p.days_of_week)
    and (d.day::date + t.time::time) at time zone p.timezone >= p.effective_from
  on conflict (medication_id,scheduled_day,scheduled_time) do nothing;
end;
$$;
revoke all on function public.sync_medication_reminders() from public, anon;
grant execute on function public.sync_medication_reminders() to authenticated, service_role;
-- Generic transport ledger, never stores medication names, doses or notes.
create table public.push_deliveries (
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  category text not null check (category in ('checkin','health','workout')),
  event_key text not null,
  delivered_at timestamptz,
  attempted_at timestamptz not null default now(),
  attempts integer not null default 1,
  primary key (subscription_id,category,event_key)
);
alter table public.push_deliveries enable row level security;
revoke all on public.push_deliveries from anon, authenticated;
grant all on public.push_deliveries to service_role;
create index push_deliveries_attempted_idx on public.push_deliveries(attempted_at);
create function public.claim_push_delivery(p_subscription uuid,p_category text,p_event text) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare claimed boolean;
begin
  insert into public.push_deliveries(subscription_id,category,event_key) values(p_subscription,p_category,p_event)
  on conflict(subscription_id,category,event_key) do update
    set attempted_at=now(), attempts=public.push_deliveries.attempts+1
    where public.push_deliveries.delivered_at is null
      and public.push_deliveries.attempted_at < now()-interval '5 minutes'
      and public.push_deliveries.attempts < 5
  returning true into claimed;
  return coalesce(claimed,false);
end;
$$;
revoke all on function public.claim_push_delivery(uuid,text,text) from public, anon, authenticated;
grant execute on function public.claim_push_delivery(uuid,text,text) to service_role;
