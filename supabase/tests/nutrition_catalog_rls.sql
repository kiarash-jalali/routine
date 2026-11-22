-- Nutrition catalog RLS (roadmap S1). Run in the SQL editor or psql after the
-- catalog schema and seed migrations. Synthetic users and records always roll back.
begin;
select set_config('test.owner',gen_random_uuid()::text,true);
select set_config('test.other',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('test.owner')::uuid),(current_setting('test.other')::uuid);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
do $$
declare food_id uuid; recipe_id uuid; catalog_recipe uuid; catalog_food uuid;
begin
  if (select count(*) from public.foods where owner_id is null)<353 then raise exception 'Catalog foods not readable'; end if;
  if (select count(*) from public.recipes where owner_id is null)<40 then raise exception 'Starter recipes not readable'; end if;
  select id into catalog_food from public.foods where slug='ing-chicken-breast';
  select id into catalog_recipe from public.recipes where slug='starter-b01';

  -- Catalog rows are read-only.
  update public.foods set name_en='Forbidden' where id=catalog_food;
  if found then raise exception 'Catalog food updated'; end if;
  delete from public.recipes where id=catalog_recipe;
  if found then raise exception 'Catalog recipe deleted'; end if;
  begin
    insert into public.foods(owner_id,slug,kind,name_en) values(null,'forbidden-food','ingredient','Forbidden');
    raise exception 'Catalog food inserted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.recipe_ingredients(recipe_id,owner_id,food_id,grams) values(catalog_recipe,auth.uid(),catalog_food,10);
    raise exception 'Ingredient attached to a catalog recipe';
  exception when foreign_key_violation then null; end;

  -- Owner CRUD on own rows, referencing catalog foods.
  insert into public.foods(owner_id,kind,name_en,kcal_100g,protein_100g) values(auth.uid(),'ingredient','Synthetic food',100,10) returning id into food_id;
  insert into public.recipes(owner_id,title_en,category,servings,copied_from) values(auth.uid(),'Synthetic recipe','main',2,catalog_recipe) returning id into recipe_id;
  insert into public.recipe_ingredients(recipe_id,owner_id,food_id,grams) values(recipe_id,auth.uid(),food_id,100),(recipe_id,auth.uid(),catalog_food,150);
  update public.foods set name_en='Synthetic food 2' where id=food_id;
  if not found then raise exception 'Owner update failed'; end if;
  perform set_config('test.food',food_id::text,true);
  perform set_config('test.recipe',recipe_id::text,true);
end;
$$;
select set_config('request.jwt.claim.sub',current_setting('test.other'),true);
do $$
declare other_recipe uuid;
begin
  if exists(select 1 from public.foods where id=current_setting('test.food')::uuid) then raise exception 'Cross-user food read'; end if;
  if exists(select 1 from public.recipes where id=current_setting('test.recipe')::uuid) then raise exception 'Cross-user recipe read'; end if;
  if exists(select 1 from public.recipe_ingredients where recipe_id=current_setting('test.recipe')::uuid) then raise exception 'Cross-user ingredient read'; end if;
  update public.foods set name_en='Forbidden' where id=current_setting('test.food')::uuid;
  if found then raise exception 'Cross-user update'; end if;
  begin
    insert into public.recipe_ingredients(recipe_id,owner_id,grams,name_en) values(current_setting('test.recipe')::uuid,auth.uid(),10,'Forbidden');
    raise exception 'Cross-user recipe foreign key accepted';
  exception when foreign_key_violation then null; end;
  insert into public.recipes(owner_id,title_en,category) values(auth.uid(),'Other recipe','main') returning id into other_recipe;
  begin
    insert into public.recipe_ingredients(recipe_id,owner_id,food_id,grams) values(other_recipe,auth.uid(),current_setting('test.food')::uuid,10);
    raise exception 'Another user''s food accepted';
  exception when insufficient_privilege then null; end;
end;
$$;
set local role anon;
do $$ begin
  begin perform 1 from public.foods; raise exception 'Anonymous catalog access'; exception when insufficient_privilege then null; end;
end; $$;
rollback;
