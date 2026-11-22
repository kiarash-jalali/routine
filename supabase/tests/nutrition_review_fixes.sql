-- Review fixes for S1/S6 (20261122120000_nutrition_review_fixes). Synthetic users
-- and records always roll back.
begin;
select set_config('test.owner',gen_random_uuid()::text,true);
select set_config('test.other',gen_random_uuid()::text,true);
select set_config('test.gone',gen_random_uuid()::text,true);
insert into auth.users(id) values
  (current_setting('test.owner')::uuid),(current_setting('test.other')::uuid),(current_setting('test.gone')::uuid);
set local role authenticated;

-- 1. Deleting an own food used by an own recipe keeps a named ingredient line.
select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
do $$
declare v_food uuid; v_recipe uuid; v_line uuid; v_name text; v_food_id uuid;
begin
  insert into public.foods(owner_id,kind,name_en) values(auth.uid(),'ingredient','Synthetic oats') returning id into v_food;
  insert into public.recipes(owner_id,title_en,category) values(auth.uid(),'Synthetic porridge','breakfast') returning id into v_recipe;
  insert into public.recipe_ingredients(recipe_id,owner_id,food_id,grams) values(v_recipe,auth.uid(),v_food,50) returning id into v_line;
  delete from public.foods where id = v_food;
  select name_en, food_id into v_name, v_food_id from public.recipe_ingredients where id = v_line;
  if v_name is distinct from 'Synthetic oats' or v_food_id is not null then
    raise exception 'Ingredient lost its name on food delete';
  end if;
end;
$$;

-- 2. save_plan_exercises: logged exercises are archived, unlogged ones deleted.
do $$
declare v_plan uuid; v_session uuid; v_logged uuid; v_unlogged uuid; v_kept uuid;
begin
  insert into public.workout_plans(user_id,name,activity_type,duration_minutes,preferred_time)
  values(auth.uid(),'Synthetic strength','Strength',30,'18:00') returning id into v_plan;
  perform public.save_plan_exercises(v_plan, jsonb_build_array(
    jsonb_build_object('name','Squat','target_sets',3,'rep_scheme','3x10'),
    jsonb_build_object('name','Lunge','target_sets',3,'rep_scheme','3x8'),
    jsonb_build_object('name','Plank','target_sets',2,'rep_scheme','30s')));
  select id into v_logged from public.workout_plan_exercises where plan_id=v_plan and name='Squat';
  select id into v_unlogged from public.workout_plan_exercises where plan_id=v_plan and name='Lunge';
  select id into v_kept from public.workout_plan_exercises where plan_id=v_plan and name='Plank';
  if (select position from public.workout_plan_exercises where id=v_kept) <> 2 then raise exception 'Insert position wrong'; end if;

  insert into public.workout_sessions(user_id,workout_id,name,activity_type,duration_minutes,scheduled_day,scheduled_time,scheduled_at,timezone)
  values(auth.uid(),v_plan,'Synthetic strength','Strength',30,current_date,'18:00',now(),'UTC') returning id into v_session;
  insert into public.workout_set_logs(session_id,exercise_id,user_id,set_number,reps) values(v_session,v_logged,auth.uid(),1,10);

  -- A direct delete of an exercise with logged sets is refused.
  begin
    delete from public.workout_plan_exercises where id = v_logged;
    raise exception 'Logged exercise deleted directly';
  exception when foreign_key_violation then null; end;

  perform public.save_plan_exercises(v_plan, jsonb_build_array(
    jsonb_build_object('id',v_kept,'name','Side plank','target_sets',2,'rep_scheme','30s')));
  if (select archived_at from public.workout_plan_exercises where id=v_logged) is null then raise exception 'Logged exercise not archived'; end if;
  if exists(select 1 from public.workout_plan_exercises where id=v_unlogged) then raise exception 'Unlogged exercise not deleted'; end if;
  if not exists(select 1 from public.workout_set_logs where exercise_id=v_logged) then raise exception 'Set history lost'; end if;
  if (select name || position from public.workout_plan_exercises where id=v_kept) <> 'Side plank0' then raise exception 'Update not applied'; end if;

  -- An archived exercise can't be edited through the RPC.
  begin
    perform public.save_plan_exercises(v_plan, jsonb_build_array(jsonb_build_object('id',v_logged,'name','Squat','target_sets',3,'rep_scheme','')));
    raise exception 'Archived exercise edited';
  exception when insufficient_privilege then null; end;

  perform set_config('test.plan',v_plan::text,true);
end;
$$;

-- 3. Schedule change keeps a future uncompleted session that has logged sets.
do $$
declare v_plan uuid := current_setting('test.plan')::uuid; v_session uuid; v_ex uuid;
begin
  select id into v_ex from public.workout_plan_exercises where plan_id=v_plan and archived_at is null limit 1;
  insert into public.workout_sessions(user_id,workout_id,name,activity_type,duration_minutes,scheduled_day,scheduled_time,scheduled_at,timezone,schedule_version)
  values(auth.uid(),v_plan,'Synthetic strength','Strength',30,current_date+1,'07:00',now()+interval '1 day','UTC',1) returning id into v_session;
  insert into public.workout_set_logs(session_id,exercise_id,user_id,set_number,reps) values(v_session,v_ex,auth.uid(),1,8);
  update public.workout_plans set schedule_version = schedule_version + 1 where id = v_plan;
  perform public.sync_workout_sessions(auth.uid());
  if not exists(select 1 from public.workout_sessions where id=v_session) then raise exception 'Logged session removed by sync'; end if;
end;
$$;

-- 3b. Deleting a plan with archived exercises and logged sets succeeds.
do $$
declare v_plan uuid := current_setting('test.plan')::uuid;
begin
  delete from public.workout_plans where id = v_plan;
  if exists(select 1 from public.workout_plan_exercises where plan_id = v_plan) then raise exception 'Plan exercises left behind'; end if;
end;
$$;

-- 4. Another user can't save exercises on the owner's plan (now deleted, so use a fresh one).
do $$
declare v_plan uuid;
begin
  insert into public.workout_plans(user_id,name,activity_type,duration_minutes,preferred_time)
  values(auth.uid(),'Synthetic mobility','Mobility',15,'08:00') returning id into v_plan;
  perform set_config('test.plan',v_plan::text,true);
end;
$$;
-- 4. Another user can't save exercises on the owner's plan.
select set_config('request.jwt.claim.sub',current_setting('test.other'),true);
do $$ begin
  begin
    perform public.save_plan_exercises(current_setting('test.plan')::uuid, '[]'::jsonb);
    raise exception 'Cross-user exercise save';
  exception when insufficient_privilege then null; end;
end; $$;

-- 5. Deleting an account with foods, recipes, exercises and set logs succeeds.
select set_config('request.jwt.claim.sub',current_setting('test.gone'),true);
do $$
declare v_food uuid; v_recipe uuid; v_plan uuid; v_session uuid; v_ex uuid;
begin
  insert into public.foods(owner_id,kind,name_fa) values(auth.uid(),'ingredient','عدس') returning id into v_food;
  insert into public.recipes(owner_id,title_en,category) values(auth.uid(),'Synthetic soup','soup') returning id into v_recipe;
  insert into public.recipe_ingredients(recipe_id,owner_id,food_id,grams) values(v_recipe,auth.uid(),v_food,80);
  insert into public.workout_plans(user_id,name,activity_type,duration_minutes,preferred_time)
  values(auth.uid(),'Synthetic walk','Walk',20,'09:00') returning id into v_plan;
  insert into public.workout_plan_exercises(plan_id,user_id,name) values(v_plan,auth.uid(),'Step') returning id into v_ex;
  insert into public.workout_sessions(user_id,workout_id,name,activity_type,duration_minutes,scheduled_day,scheduled_time,scheduled_at,timezone)
  values(auth.uid(),v_plan,'Synthetic walk','Walk',20,current_date,'09:00',now(),'UTC') returning id into v_session;
  insert into public.workout_set_logs(session_id,exercise_id,user_id,set_number,reps) values(v_session,v_ex,auth.uid(),1,1);
end;
$$;
reset role;
delete from auth.users where id = current_setting('test.gone')::uuid;

-- 6. Anonymous callers can't run the RPC.
set local role anon;
do $$ begin
  begin perform public.save_plan_exercises(gen_random_uuid(), '[]'::jsonb); raise exception 'Anonymous RPC access';
  exception when insufficient_privilege then null; end;
end; $$;
rollback;
