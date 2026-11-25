-- Run in the SQL editor or psql. Synthetic users and records always roll back.
begin;
select set_config('test.owner',gen_random_uuid()::text,true);
select set_config('test.other',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('test.owner')::uuid),(current_setting('test.other')::uuid);
insert into public.notification_preferences(user_id,timezone) values(current_setting('test.owner')::uuid,'Asia/Tehran')
on conflict (user_id) do update set timezone='Asia/Tehran';
do $$
declare phone uuid; laptop uuid; v_days boolean[]; v_owner uuid := current_setting('test.owner')::uuid;
begin
  insert into public.push_subscriptions(user_id,endpoint,p256dh,auth)
  values(v_owner,'https://fcm.googleapis.com/fcm/send/test-'||gen_random_uuid(),'p','a') returning id into phone;
  insert into public.push_subscriptions(user_id,endpoint,p256dh,auth)
  values(v_owner,'https://fcm.googleapis.com/fcm/send/test-'||gen_random_uuid(),'p','a') returning id into laptop;
  -- Two pushes per day on six past days.
  insert into public.push_deliveries(subscription_id,category,event_key,delivered_at)
  select phone,'checkin','checkin:d'||n||':'||m, now()-make_interval(days=>n,secs=>m)
  from generate_series(1,6) n, generate_series(0,1) m;
  insert into public.push_deliveries(subscription_id,category,event_key,delivered_at)
  values(phone,'checkin','checkin:today',now()),(phone,'checkin','routine:x',now()-interval '1 day');

  select r.opened into v_days from public.reminder_recent_days(array[v_owner],now()-interval '30 days') r where r.category='checkin';
  if v_days is distinct from array[false,false,false,false,false] then raise exception 'Expected five unopened days, got %',v_days; end if;
  select r.opened into v_days from public.reminder_recent_days(array[v_owner],now()-interval '30 days') r where r.category='routine';
  if v_days is distinct from array[false] then raise exception 'Routine pushes must be their own category'; end if;

  -- An open on another device today clears it at once.
  insert into public.push_deliveries(subscription_id,category,event_key,delivered_at,opened_at)
  values(laptop,'checkin','checkin:today',now(),now());
  select r.opened into v_days from public.reminder_recent_days(array[v_owner],now()-interval '30 days') r where r.category='checkin';
  if v_days[1] is not true or cardinality(v_days)<>5 then raise exception 'Open today not counted: %',v_days; end if;

  -- Keep / Change time restart the count; the floor applies too.
  insert into public.reminder_adaptations(user_id,category,counted_from) values(v_owner,'checkin',now()+interval '30 days');
  if exists(select 1 from public.reminder_recent_days(array[v_owner],now()-interval '30 days') r where r.category='checkin') then raise exception 'counted_from ignored'; end if;
  if exists(select 1 from public.reminder_recent_days(array[v_owner],now()+interval '1 day')) then raise exception 'p_since ignored'; end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
do $$
begin
  update public.reminder_adaptations set counted_from=now() where category='checkin';
  if not found then raise exception 'Owner update failed'; end if;
  begin
    insert into public.reminder_adaptations(user_id,category) values(current_setting('test.other')::uuid,'task');
    raise exception 'Cross-user insert accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.reminder_recent_days(array[auth.uid()],now());
    raise exception 'Users can call the service function';
  exception when insufficient_privilege then null; end;
end;
$$;
select set_config('request.jwt.claim.sub',current_setting('test.other'),true);
do $$
begin
  if exists(select 1 from public.reminder_adaptations) then raise exception 'Cross-user read'; end if;
  update public.reminder_adaptations set counted_from=now();
  if found then raise exception 'Cross-user update'; end if;
  delete from public.reminder_adaptations;
  if found then raise exception 'Cross-user delete'; end if;
end;
$$;
set local role anon;
do $$
begin
  perform 1 from public.reminder_adaptations;
  raise exception 'Anon can read';
exception when insufficient_privilege then null;
end;
$$;
rollback;
