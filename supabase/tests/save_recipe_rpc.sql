-- save_recipe RPC (roadmap S3). Run in the SQL editor or psql after
-- 20261122150000_save_recipe_rpc.sql. Synthetic users and records always roll back.
begin;
select set_config('test.owner',gen_random_uuid()::text,true);
select set_config('test.other',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('test.owner')::uuid),(current_setting('test.other')::uuid);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
do $$
declare starter uuid; catalog_food uuid; copy_id uuid; before_count integer; catalog_title text;
begin
  select id, title_en into starter, catalog_title from public.recipes where slug='starter-b01';
  select id into catalog_food from public.foods where slug='ing-chicken-breast';
  select count(*) into before_count from public.recipe_ingredients where recipe_id=starter;

  -- "Save to my recipes": a user-owned copy of recipe and ingredients.
  copy_id := public.save_recipe(null,
    jsonb_build_object('title_en','Copy','category','breakfast','servings',2,'copied_from',starter,'tags',jsonb_build_array('quick'),'steps_en',jsonb_build_array('One','Two')),
    jsonb_build_array(
      jsonb_build_object('food_id',catalog_food,'grams',150,'amount_en','1 piece'),
      jsonb_build_object('name_en','Salt','grams',0,'is_staple',true)));
  if (select owner_id from public.recipes where id=copy_id) is distinct from auth.uid() then raise exception 'Copy not owned'; end if;
  if (select copied_from from public.recipes where id=copy_id) is distinct from starter then raise exception 'copied_from missing'; end if;
  if (select count(*) from public.recipe_ingredients where recipe_id=copy_id and owner_id=auth.uid())<>2 then raise exception 'Ingredients not copied'; end if;
  if (select steps_en from public.recipes where id=copy_id)<>array['One','Two'] then raise exception 'Steps not saved'; end if;

  -- Editing replaces the ingredient list in order.
  perform public.save_recipe(copy_id,
    jsonb_build_object('title_en','Copy 2','category','main','servings',3),
    jsonb_build_array(jsonb_build_object('name_en','Water','grams',250)));
  if (select title_en from public.recipes where id=copy_id)<>'Copy 2' then raise exception 'Edit failed'; end if;
  if (select count(*) from public.recipe_ingredients where recipe_id=copy_id)<>1 then raise exception 'Ingredients not replaced'; end if;
  if (select copied_from from public.recipes where id=copy_id) is distinct from starter then raise exception 'Edit cleared copied_from'; end if;

  -- Catalog recipes can never be edited through the RPC.
  begin
    perform public.save_recipe(starter, jsonb_build_object('title_en','Forbidden','category','main'), '[]'::jsonb);
    raise exception 'Catalog recipe edited';
  exception when insufficient_privilege then null; end;
  if (select title_en from public.recipes where id=starter) is distinct from catalog_title then raise exception 'Catalog title changed'; end if;
  if (select count(*) from public.recipe_ingredients where recipe_id=starter)<>before_count then raise exception 'Catalog ingredients changed'; end if;

  -- A failed save leaves nothing behind (invalid servings).
  begin
    perform public.save_recipe(null, jsonb_build_object('title_en','Bad','category','main','servings',50), '[]'::jsonb);
    raise exception 'Invalid recipe saved';
  exception when check_violation then null; end;
  perform set_config('test.copy',copy_id::text,true);
end;
$$;
select set_config('request.jwt.claim.sub',current_setting('test.other'),true);
do $$
begin
  begin
    perform public.save_recipe(current_setting('test.copy')::uuid, jsonb_build_object('title_en','Forbidden','category','main'), '[]'::jsonb);
    raise exception 'Cross-user recipe edited';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
set local role anon;
do $$
begin
  begin
    perform public.save_recipe(null, jsonb_build_object('title_en','Anon','category','main'), '[]'::jsonb);
    raise exception 'Anon executed save_recipe';
  exception when insufficient_privilege then null; end;
end;
$$;
rollback;
