-- Fix PL/pgSQL output-column ambiguity in the daily progress RPCs.
-- Production version: 20260919080029.

create or replace function public.set_daily_item_completion(
  p_day date,
  p_item_type text,
  p_item_id uuid,
  p_completed boolean
)
returns table (
  id uuid,
  user_id uuid,
  day date,
  completed_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_checkin_id uuid;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_day is null or p_item_id is null or p_completed is null then
    raise exception 'invalid_daily_item';
  end if;

  if p_item_type = 'task' then
    if not exists (
      select 1
      from public.tasks
      where tasks.id = p_item_id
        and tasks.user_id = current_user_id
    ) then
      raise exception 'daily_item_not_found';
    end if;
  elsif p_item_type = 'routine' then
    if not exists (
      select 1
      from public.routines
      where routines.id = p_item_id
        and routines.user_id = current_user_id
    ) then
      raise exception 'daily_item_not_found';
    end if;
  else
    raise exception 'invalid_daily_item_type';
  end if;

  insert into public.daily_checkins (user_id, day)
  values (current_user_id, p_day)
  on conflict on constraint daily_checkins_user_id_day_key
  do update set updated_at = now()
  returning daily_checkins.id into current_checkin_id;

  insert into public.checkin_items (
    user_id,
    checkin_id,
    item_type,
    item_id,
    completed
  )
  values (
    current_user_id,
    current_checkin_id,
    p_item_type,
    p_item_id,
    p_completed
  )
  on conflict (checkin_id, item_type, item_id)
  do update set
    completed = excluded.completed,
    user_id = excluded.user_id;

  if p_item_type = 'task' then
    update public.tasks
    set is_done = p_completed
    where tasks.id = p_item_id
      and tasks.user_id = current_user_id;
  end if;

  return query
  select
    daily_checkins.id,
    daily_checkins.user_id,
    daily_checkins.day,
    daily_checkins.completed_at
  from public.daily_checkins
  where daily_checkins.id = current_checkin_id;
end;
$$;

create or replace function public.finish_daily_checkin(
  p_day date,
  p_items jsonb
)
returns table (
  id uuid,
  user_id uuid,
  day date,
  completed_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_checkin_id uuid;
  item record;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_day is null then
    raise exception 'invalid_checkin_day';
  end if;

  insert into public.daily_checkins (user_id, day)
  values (current_user_id, p_day)
  on conflict on constraint daily_checkins_user_id_day_key
  do update set updated_at = now()
  returning daily_checkins.id into current_checkin_id;

  for item in
    select *
    from pg_catalog.jsonb_to_recordset(coalesce(p_items, '[]'::jsonb))
      as x(item_type text, item_id uuid, completed boolean)
  loop
    if item.item_id is null or item.completed is null then
      raise exception 'invalid_daily_item';
    end if;

    if item.item_type = 'task' then
      if not exists (
        select 1
        from public.tasks
        where tasks.id = item.item_id
          and tasks.user_id = current_user_id
      ) then
        raise exception 'daily_item_not_found';
      end if;
    elsif item.item_type = 'routine' then
      if not exists (
        select 1
        from public.routines
        where routines.id = item.item_id
          and routines.user_id = current_user_id
      ) then
        raise exception 'daily_item_not_found';
      end if;
    else
      raise exception 'invalid_daily_item_type';
    end if;

    insert into public.checkin_items (
      user_id,
      checkin_id,
      item_type,
      item_id,
      completed
    )
    values (
      current_user_id,
      current_checkin_id,
      item.item_type,
      item.item_id,
      item.completed
    )
    on conflict (checkin_id, item_type, item_id)
    do update set
      completed = excluded.completed,
      user_id = excluded.user_id;

    if item.item_type = 'task' then
      update public.tasks
      set is_done = item.completed
      where tasks.id = item.item_id
        and tasks.user_id = current_user_id;
    end if;
  end loop;

  update public.daily_checkins
  set completed_at = coalesce(daily_checkins.completed_at, now())
  where daily_checkins.id = current_checkin_id;

  return query
  select
    daily_checkins.id,
    daily_checkins.user_id,
    daily_checkins.day,
    daily_checkins.completed_at
  from public.daily_checkins
  where daily_checkins.id = current_checkin_id;
end;
$$;

revoke all on function public.set_daily_item_completion(date, text, uuid, boolean)
  from public, anon;
grant execute on function public.set_daily_item_completion(date, text, uuid, boolean)
  to authenticated;

revoke all on function public.finish_daily_checkin(date, jsonb)
  from public, anon;
grant execute on function public.finish_daily_checkin(date, jsonb)
  to authenticated;
