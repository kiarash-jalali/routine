-- Run in the SQL editor or psql. Synthetic users and records always roll back.
begin;
select set_config('test.owner',gen_random_uuid()::text,true);
select set_config('test.other',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('test.owner')::uuid),(current_setting('test.other')::uuid);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
do $$
declare plan_id uuid; occurrences integer;
begin
  insert into public.workout_plans(user_id,name,activity_type,duration_minutes,preferred_time,days_of_week,timezone,effective_from)
  values(auth.uid(),'Synthetic schedule','Walking',20,'23:59',array[1,2,3,4,5,6,7],'UTC',now()-interval '2 days') returning id into plan_id;
  perform set_config('test.plan',plan_id::text,true);
  perform public.sync_workout_sessions();
  select count(*) into occurrences from public.workout_sessions where workout_id=plan_id;
  if occurrences<2 then raise exception 'Schedule did not materialize'; end if;
  perform public.sync_workout_sessions();
  if (select count(*) from public.workout_sessions where workout_id=plan_id)<>occurrences then raise exception 'Duplicate occurrences'; end if;
  update public.workout_sessions set completed_at=now() where workout_id=plan_id and scheduled_at<now();
  update public.workout_plans set is_active=false where id=plan_id;
  perform public.sync_workout_sessions();
  if exists(select 1 from public.workout_sessions where workout_id=plan_id and scheduled_at>=now() and completed_at is null) then raise exception 'Paused future reminders remain'; end if;
  if not exists(select 1 from public.workout_sessions where workout_id=plan_id and completed_at is not null) then raise exception 'Completion history was lost'; end if;
  begin
    insert into public.workout_plans(user_id,name,activity_type,duration_minutes,preferred_time) values(current_setting('test.other')::uuid,'Forbidden','Walk',20,'09:00');
    raise exception 'Cross-user insert accepted';
  exception when insufficient_privilege then null; end;
end;
$$;
select set_config('request.jwt.claim.sub',current_setting('test.other'),true);
do $$
begin
  if exists(select 1 from public.workout_plans where id=current_setting('test.plan')::uuid) then raise exception 'Cross-user plan read'; end if;
  if exists(select 1 from public.workout_sessions where workout_id=current_setting('test.plan')::uuid) then raise exception 'Cross-user reminder read'; end if;
  update public.workout_plans set name='Forbidden' where id=current_setting('test.plan')::uuid;
  if found then raise exception 'Cross-user update'; end if;
  begin
    insert into public.workout_sessions(user_id,workout_id,scheduled_day,scheduled_time,scheduled_at,timezone,name,activity_type,duration_minutes,schedule_version)
    values(auth.uid(),current_setting('test.plan')::uuid,current_date,'09:00',now(),'UTC','Forbidden','Walk',20,1);
    raise exception 'Cross-user foreign key accepted';
  exception when foreign_key_violation then null; end;
  begin
    perform public.claim_push_delivery(gen_random_uuid(),'health','forbidden');
    raise exception 'Browser can invoke service delivery claim';
  exception when insufficient_privilege then null; end;
end;
$$;
set local role anon;
do $$ begin
  begin perform 1 from public.workout_plans; raise exception 'Anonymous health access'; exception when insufficient_privilege then null; end;
end; $$;
rollback;
