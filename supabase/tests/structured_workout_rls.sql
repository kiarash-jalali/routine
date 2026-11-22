-- Structured workouts RLS (roadmap S6). Synthetic users and records always roll back.
begin;
select set_config('test.owner',gen_random_uuid()::text,true);
select set_config('test.other',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('test.owner')::uuid),(current_setting('test.other')::uuid);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
do $$
declare v_plan uuid; v_session uuid; v_exercise uuid;
begin
  insert into public.workout_plans(user_id,name,activity_type,duration_minutes,preferred_time)
  values(auth.uid(),'Synthetic strength','Strength',30,'18:00') returning id into v_plan;
  insert into public.workout_sessions(user_id,workout_id,name,activity_type,duration_minutes,scheduled_day,scheduled_time,scheduled_at,timezone)
  values(auth.uid(),v_plan,'Synthetic strength','Strength',30,current_date,'18:00',now(),'UTC') returning id into v_session;
  insert into public.workout_plan_exercises(plan_id,user_id,position,name,target_sets,rep_scheme)
  values(v_plan,auth.uid(),0,'Squat',3,'3x10') returning id into v_exercise;
  insert into public.workout_set_logs(session_id,exercise_id,user_id,set_number,reps,weight_kg)
  values(v_session,v_exercise,auth.uid(),1,10,20);
  update public.workout_set_logs set reps=11 where session_id=v_session and set_number=1;
  if not found then raise exception 'Owner update failed'; end if;
  perform set_config('test.plan',v_plan::text,true);
  perform set_config('test.session',v_session::text,true);
  perform set_config('test.exercise',v_exercise::text,true);
end;
$$;
select set_config('request.jwt.claim.sub',current_setting('test.other'),true);
do $$
declare own_plan uuid;
begin
  if exists(select 1 from public.workout_plan_exercises where id=current_setting('test.exercise')::uuid) then raise exception 'Cross-user exercise read'; end if;
  if exists(select 1 from public.workout_set_logs where session_id=current_setting('test.session')::uuid) then raise exception 'Cross-user set read'; end if;
  begin
    insert into public.workout_plan_exercises(plan_id,user_id,name) values(current_setting('test.plan')::uuid,auth.uid(),'Forbidden');
    raise exception 'Exercise attached to another user''s plan';
  exception when foreign_key_violation then null; end;
  insert into public.workout_plans(user_id,name,activity_type,duration_minutes,preferred_time)
  values(auth.uid(),'Own plan','Walk',20,'09:00') returning id into own_plan;
  begin
    insert into public.workout_set_logs(session_id,exercise_id,user_id,set_number,reps)
    values(current_setting('test.session')::uuid,current_setting('test.exercise')::uuid,auth.uid(),2,10);
    raise exception 'Set logged on another user''s session';
  exception when foreign_key_violation then null; end;
end;
$$;
set local role anon;
do $$ begin
  begin perform 1 from public.workout_set_logs; raise exception 'Anonymous set access'; exception when insufficient_privilege then null; end;
end; $$;
rollback;
