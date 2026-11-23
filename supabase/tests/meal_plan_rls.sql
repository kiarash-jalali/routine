-- Run in the SQL editor or psql. Synthetic users and records always roll back.
-- Covers meal_plan_entries, grocery_lists, grocery_list_items and the
-- save_grocery_list and add_grocery_item RPCs (S4).
begin;
select set_config('test.owner',gen_random_uuid()::text,true);
select set_config('test.other',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('test.owner')::uuid),(current_setting('test.other')::uuid);
select set_config('test.catalog_recipe',(select id::text from public.recipes where owner_id is null order by slug limit 1),true);
select set_config('test.catalog_food',(select id::text from public.foods where owner_id is null order by slug limit 1),true);
set local role authenticated;

-- The other user owns a private recipe.
select set_config('request.jwt.claim.sub',current_setting('test.other'),true);
do $$
declare private_recipe uuid;
begin
  insert into public.recipes(owner_id,title_en,category,servings) values(auth.uid(),'Private','main',2) returning id into private_recipe;
  perform set_config('test.private_recipe',private_recipe::text,true);
  insert into public.foods(owner_id,kind,name_en) values(auth.uid(),'ingredient','Private food') returning id into private_recipe;
  perform set_config('test.private_food',private_recipe::text,true);
end;
$$;

select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
do $$
declare entry_id uuid; v_list uuid; v_item uuid; kept uuid;
begin
  -- Owner CRUD on plan entries (catalog recipe and catalog food).
  insert into public.meal_plan_entries(user_id,plan_date,slot,recipe_id,cook_servings,eaten_portions)
  values(auth.uid(),current_date,'lunch',current_setting('test.catalog_recipe')::uuid,4,1.5) returning id into entry_id;
  perform set_config('test.entry',entry_id::text,true);
  insert into public.meal_plan_entries(user_id,plan_date,slot,food_id)
  values(auth.uid(),current_date,'snack',current_setting('test.catalog_food')::uuid);
  update public.meal_plan_entries set slot='dinner', position=1 where id=entry_id;
  if not found then raise exception 'Owner plan update failed'; end if;

  -- Constraints: exactly one item, portions in range, cook servings only for recipes.
  begin
    insert into public.meal_plan_entries(user_id,plan_date,slot) values(auth.uid(),current_date,'lunch');
    raise exception 'Entry without recipe or food accepted';
  exception when check_violation then null; end;
  begin
    insert into public.meal_plan_entries(user_id,plan_date,slot,recipe_id,food_id)
    values(auth.uid(),current_date,'lunch',current_setting('test.catalog_recipe')::uuid,current_setting('test.catalog_food')::uuid);
    raise exception 'Entry with recipe and food accepted';
  exception when check_violation then null; end;
  begin
    insert into public.meal_plan_entries(user_id,plan_date,slot,food_id,eaten_portions)
    values(auth.uid(),current_date,'lunch',current_setting('test.catalog_food')::uuid,30);
    raise exception 'Out-of-range portions accepted';
  exception when check_violation then null; end;
  begin
    insert into public.meal_plan_entries(user_id,plan_date,slot,food_id,cook_servings)
    values(auth.uid(),current_date,'lunch',current_setting('test.catalog_food')::uuid,2);
    raise exception 'Cook servings on a food accepted';
  exception when check_violation then null; end;

  -- Cannot plan another user's private recipe, or write rows for someone else.
  begin
    insert into public.meal_plan_entries(user_id,plan_date,slot,recipe_id)
    values(auth.uid(),current_date,'lunch',current_setting('test.private_recipe')::uuid);
    raise exception 'Private recipe of another user planned';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.meal_plan_entries(user_id,plan_date,slot,food_id)
    values(current_setting('test.other')::uuid,current_date,'lunch',current_setting('test.catalog_food')::uuid);
    raise exception 'Cross-user plan insert accepted';
  exception when insufficient_privilege then null; end;

  -- save_grocery_list creates the list, keeps ids and flags, deletes missing items.
  v_list := public.save_grocery_list(current_date, false, jsonb_build_array(
    jsonb_build_object('food_id',current_setting('test.catalog_food'),'name_en','Food','grams',200,'grocery_section','produce'),
    jsonb_build_object('name_en','Dish soap','is_manual',true)
  ));
  perform set_config('test.list',v_list::text,true);
  if (select count(*) from public.grocery_list_items where list_id=v_list) <> 2 then raise exception 'RPC insert failed'; end if;
  select id into v_item from public.grocery_list_items g where g.list_id=v_list and not is_manual;
  perform set_config('test.item',v_item::text,true);
  select id into kept from public.grocery_list_items g where g.list_id=v_list and is_manual;
  update public.grocery_list_items set have=true where id=v_item;
  -- Regenerate: same food keeps its id, payload flags never overwrite stored ones; manual dropped.
  perform public.save_grocery_list(current_date, true, jsonb_build_array(
    jsonb_build_object('id',v_item,'food_id',current_setting('test.catalog_food'),'name_en','Food','grams',400,'grocery_section','produce','have',false)
  ));
  if (select have from public.grocery_list_items where id=v_item) is distinct from true then raise exception 'RPC overwrote a tick'; end if;
  if (select grams from public.grocery_list_items where id=v_item) <> 400 then raise exception 'RPC update failed'; end if;
  if exists(select 1 from public.grocery_list_items where id=kept) then raise exception 'RPC kept a removed item'; end if;
  if (select include_staples from public.grocery_lists where id=v_list) is distinct from true then raise exception 'RPC staples flag'; end if;

  -- A stale id is re-inserted with a fresh id, not dropped.
  perform public.save_grocery_list(current_date, true, jsonb_build_array(
    jsonb_build_object('id',v_item,'food_id',current_setting('test.catalog_food'),'name_en','Food','grams',400,'grocery_section','produce'),
    jsonb_build_object('id',kept,'name_en','Dish soap','is_manual',true)
  ));
  if not exists(select 1 from public.grocery_list_items g where g.list_id=v_list and g.name_en='Dish soap' and g.id<>kept) then raise exception 'Stale id dropped'; end if;

  -- add_grocery_item appends to an existing list and creates a missing one.
  perform public.add_grocery_item(current_date,'Bread','');
  if not exists(select 1 from public.grocery_list_items g where g.list_id=v_list and g.name_en='Bread' and g.is_manual) then raise exception 'Manual add failed'; end if;
  perform public.add_grocery_item(current_date+7,'Bread','');
  if not exists(select 1 from public.grocery_lists where user_id=auth.uid() and week_start=current_date+7) then raise exception 'Manual add did not create list'; end if;

  -- Another user's private food cannot be linked, directly or through the RPC.
  begin
    insert into public.grocery_list_items(list_id,user_id,name_en,food_id) values(v_list,auth.uid(),'x',current_setting('test.private_food')::uuid);
    raise exception 'Private food inserted';
  exception when insufficient_privilege then null; end;
  begin
    update public.grocery_list_items set food_id=current_setting('test.private_food')::uuid where id=v_item;
    raise exception 'Private food linked';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_grocery_list(current_date, true, jsonb_build_array(jsonb_build_object('name_en','x','food_id',current_setting('test.private_food'))));
    raise exception 'Private food linked through RPC';
  exception when insufficient_privilege then null; end;

  -- Composite FK: an item cannot point at another user's list.
  begin
    insert into public.grocery_list_items(list_id,user_id,name_en) values(v_list,current_setting('test.other')::uuid,'x');
    raise exception 'Cross-user item insert accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.grocery_lists(user_id,week_start) values(current_setting('test.other')::uuid,current_date);
    raise exception 'Cross-user list insert accepted';
  exception when insufficient_privilege then null; end;
end;
$$;

select set_config('request.jwt.claim.sub',current_setting('test.other'),true);
do $$
declare own_list uuid;
begin
  if exists(select 1 from public.meal_plan_entries where id=current_setting('test.entry')::uuid) then raise exception 'Cross-user plan read'; end if;
  if exists(select 1 from public.grocery_lists where id=current_setting('test.list')::uuid) then raise exception 'Cross-user list read'; end if;
  if exists(select 1 from public.grocery_list_items where id=current_setting('test.item')::uuid) then raise exception 'Cross-user item read'; end if;
  update public.meal_plan_entries set eaten_portions=2 where id=current_setting('test.entry')::uuid;
  if found then raise exception 'Cross-user plan update'; end if;
  update public.grocery_list_items set bought=true where id=current_setting('test.item')::uuid;
  if found then raise exception 'Cross-user item update'; end if;
  delete from public.meal_plan_entries where id=current_setting('test.entry')::uuid;
  if found then raise exception 'Cross-user plan delete'; end if;
  delete from public.grocery_lists where id=current_setting('test.list')::uuid;
  if found then raise exception 'Cross-user list delete'; end if;
  -- The other user's own items cannot be attached to the owner's list (composite FK).
  begin
    insert into public.grocery_list_items(list_id,user_id,name_en) values(current_setting('test.list')::uuid,auth.uid(),'x');
    raise exception 'Item attached to another user''s list';
  exception when foreign_key_violation then null; end;
  -- A foreign id becomes a fresh row in the caller's own list.
  own_list := public.save_grocery_list(current_date, false, jsonb_build_array(
    jsonb_build_object('id',current_setting('test.item'),'name_en','Hijack','grams',1)
  ));
  if own_list = current_setting('test.list')::uuid then raise exception 'RPC wrote another user''s list'; end if;
end;
$$;

select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
do $$
begin
  if (select grams from public.grocery_list_items where id=current_setting('test.item')::uuid) <> 400 then
    raise exception 'Another user changed the owner''s item through the RPC';
  end if;
  delete from public.meal_plan_entries where id=current_setting('test.entry')::uuid;
  if not found then raise exception 'Owner plan delete failed'; end if;
  delete from public.grocery_lists where id=current_setting('test.list')::uuid;
  if not found then raise exception 'Owner list delete failed'; end if;
  if exists(select 1 from public.grocery_list_items where id=current_setting('test.item')::uuid) then raise exception 'Items survived list delete'; end if;
end;
$$;

set local role anon;
do $$ begin
  begin perform 1 from public.meal_plan_entries; raise exception 'Anonymous plan access'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.grocery_lists; raise exception 'Anonymous list access'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.grocery_list_items; raise exception 'Anonymous item access'; exception when insufficient_privilege then null; end;
  begin perform public.save_grocery_list(current_date, false, '[]'::jsonb); raise exception 'Anonymous RPC execute'; exception when insufficient_privilege then null; end;
  begin perform public.add_grocery_item(current_date, 'x', ''); raise exception 'Anonymous add execute'; exception when insufficient_privilege then null; end;
end; $$;
rollback;
