-- Run in the SQL editor or psql. Synthetic users and records always roll back.
-- Covers food_log_entries.meal_plan_entry_id: own link, cross-user denial, one
-- log per planned meal per day, and history kept when the plan is deleted.
begin;
select set_config('test.owner',gen_random_uuid()::text,true);
select set_config('test.other',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('test.owner')::uuid),(current_setting('test.other')::uuid);
set local role authenticated;

select set_config('request.jwt.claim.sub',current_setting('test.other'),true);
do $$
declare v_food uuid; v_plan uuid;
begin
  select id into v_food from public.foods where owner_id is null limit 1;
  if v_food is null then raise exception 'No catalog food to test with'; end if;
  insert into public.meal_plan_entries(user_id,plan_date,slot,food_id)
  values(auth.uid(),current_date,'lunch',v_food) returning id into v_plan;
  perform set_config('test.other_plan',v_plan::text,true);
end;
$$;

select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
do $$
declare v_food uuid; v_recipe uuid; v_plan uuid; v_recipe_plan uuid; v_log uuid; v_recipe_log uuid;
begin
  select id into v_food from public.foods where owner_id is null limit 1;
  insert into public.meal_plan_entries(user_id,plan_date,slot,food_id)
  values(auth.uid(),current_date,'lunch',v_food) returning id into v_plan;

  -- Own link.
  insert into public.food_log_entries(user_id,eaten_on,slot,source,meal_plan_entry_id,food_id,portions,label,kcal,protein)
  values(auth.uid(),current_date,'lunch','plan',v_plan,v_food,1.5,'Planned food',240,12.5) returning id into v_log;

  -- One log per planned meal per day; another day is allowed.
  begin
    insert into public.food_log_entries(user_id,eaten_on,slot,source,meal_plan_entry_id,food_id,portions,label,kcal)
    values(auth.uid(),current_date,'lunch','plan',v_plan,v_food,1,'Planned food',160);
    raise exception 'Duplicate planned log accepted';
  exception when unique_violation then null; end;
  insert into public.food_log_entries(user_id,eaten_on,slot,source,meal_plan_entry_id,food_id,portions,label,kcal)
  values(auth.uid(),current_date+1,'lunch','plan',v_plan,v_food,1,'Planned food',160);

  -- Undo (delete) frees the planned meal to be logged again.
  delete from public.food_log_entries where user_id=auth.uid() and eaten_on=current_date+1;
  insert into public.food_log_entries(user_id,eaten_on,slot,source,meal_plan_entry_id,food_id,portions,label,kcal)
  values(auth.uid(),current_date+1,'lunch','plan',v_plan,v_food,1,'Planned food',160);

  -- Another user's plan entry, and one that does not exist, are refused.
  begin
    insert into public.food_log_entries(user_id,eaten_on,slot,source,meal_plan_entry_id,food_id,portions,label,kcal)
    values(auth.uid(),current_date,'lunch','plan',current_setting('test.other_plan')::uuid,v_food,1,'x',10);
    raise exception 'Cross-user plan link accepted on insert';
  exception when foreign_key_violation then null; end;
  begin
    update public.food_log_entries set meal_plan_entry_id=current_setting('test.other_plan')::uuid where id=v_log;
    raise exception 'Cross-user plan link accepted on update';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.food_log_entries(user_id,eaten_on,slot,source,meal_plan_entry_id,label,kcal)
    values(auth.uid(),current_date,'lunch','plan',gen_random_uuid(),'x',10);
    raise exception 'Dangling plan link accepted';
  exception when foreign_key_violation then null; end;

  -- Deleting the plan entry keeps the log, its snapshot and its owner.
  delete from public.meal_plan_entries where id=v_plan;
  if not exists(
    select 1 from public.food_log_entries
    where id=v_log and user_id=auth.uid() and meal_plan_entry_id is null
      and food_id=v_food and label='Planned food' and kcal=240 and protein=12.5 and portions=1.5
  ) then raise exception 'Plan delete removed or changed the log entry'; end if;

  -- Deleting a planned recipe removes the plan entry and keeps the log.
  insert into public.recipes(owner_id,title_en,category,servings) values(auth.uid(),'My stew','main',2)
    returning id into v_recipe;
  insert into public.meal_plan_entries(user_id,plan_date,slot,recipe_id,cook_servings)
  values(auth.uid(),current_date,'dinner',v_recipe,2) returning id into v_recipe_plan;
  insert into public.food_log_entries(user_id,eaten_on,slot,source,meal_plan_entry_id,recipe_id,portions,label,kcal,protein)
  values(auth.uid(),current_date,'dinner','plan',v_recipe_plan,v_recipe,1,'My stew',520,30) returning id into v_recipe_log;
  update public.recipes set title_en='Renamed stew', servings=4 where id=v_recipe;
  if not exists(select 1 from public.food_log_entries where id=v_recipe_log and label='My stew' and kcal=520) then
    raise exception 'Recipe edit rewrote the planned log';
  end if;
  delete from public.recipes where id=v_recipe;
  if exists(select 1 from public.meal_plan_entries where id=v_recipe_plan) then
    raise exception 'Plan entry outlived its recipe';
  end if;
  if not exists(
    select 1 from public.food_log_entries
    where id=v_recipe_log and user_id=auth.uid() and recipe_id is null and meal_plan_entry_id is null
      and label='My stew' and kcal=520
  ) then raise exception 'Recipe delete removed or changed the planned log'; end if;

  -- Leave a linked pair for the account deletion check.
  insert into public.meal_plan_entries(user_id,plan_date,slot,food_id)
  values(auth.uid(),current_date,'snack',v_food) returning id into v_plan;
  insert into public.food_log_entries(user_id,eaten_on,slot,source,meal_plan_entry_id,food_id,portions,label,kcal)
  values(auth.uid(),current_date,'snack','plan',v_plan,v_food,1,'Snack',100);
end;
$$;

-- Account deletion removes plan and log rows together.
reset role;
delete from auth.users where id=current_setting('test.owner')::uuid;
do $$
begin
  if exists(select 1 from public.food_log_entries where user_id=current_setting('test.owner')::uuid)
     or exists(select 1 from public.meal_plan_entries where user_id=current_setting('test.owner')::uuid) then
    raise exception 'Account deletion left rows behind';
  end if;
end;
$$;
rollback;
