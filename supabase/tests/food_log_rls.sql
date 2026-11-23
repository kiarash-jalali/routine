-- Run in the SQL editor or psql. Synthetic users and records always roll back.
-- Covers food_log_entries (S5): owner CRUD, cross-user denial, item visibility,
-- snapshots surviving recipe edits/deletes, anon denial.
begin;
select set_config('test.owner',gen_random_uuid()::text,true);
select set_config('test.other',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('test.owner')::uuid),(current_setting('test.other')::uuid);
set local role authenticated;

-- The other user owns a private food.
select set_config('request.jwt.claim.sub',current_setting('test.other'),true);
do $$
declare private_food uuid;
begin
  insert into public.foods(owner_id,kind,name_en,kcal_100g,protein_100g) values(auth.uid(),'dish','Private soup',80,4)
    returning id into private_food;
  perform set_config('test.private_food',private_food::text,true);
end;
$$;

select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
do $$
declare entry_id uuid; catalog_food uuid; own_recipe uuid; recipe_entry uuid;
begin
  select id into catalog_food from public.foods where owner_id is null limit 1;
  if catalog_food is null then raise exception 'No catalog food to test with'; end if;

  -- Owner CRUD with a catalog food.
  insert into public.food_log_entries(user_id,eaten_on,slot,source,food_id,grams,label,kcal,protein)
  values(auth.uid(),current_date,'lunch','food',catalog_food,150,'Catalog food',240,12.5) returning id into entry_id;
  perform set_config('test.entry',entry_id::text,true);
  update public.food_log_entries set grams=300, kcal=480, protein=25 where id=entry_id;
  if not found then raise exception 'Owner update failed'; end if;
  insert into public.food_log_entries(user_id,eaten_on,slot,source,label,kcal,protein)
  values(auth.uid(),current_date,'snack','quick','Apple',95,0.5);

  -- Snapshot: editing or deleting the source recipe never changes the entry.
  insert into public.recipes(owner_id,title_en,category,servings) values(auth.uid(),'My stew','main',2)
    returning id into own_recipe;
  insert into public.food_log_entries(user_id,eaten_on,slot,source,recipe_id,portions,label,kcal,protein)
  values(auth.uid(),current_date,'dinner','recipe',own_recipe,1,'My stew',520,30) returning id into recipe_entry;
  update public.recipes set title_en='Renamed stew', servings=4 where id=own_recipe;
  if (select label from public.food_log_entries where id=recipe_entry) <> 'My stew'
     or (select kcal from public.food_log_entries where id=recipe_entry) <> 520 then
    raise exception 'Recipe edit rewrote the log entry';
  end if;
  delete from public.recipes where id=own_recipe;
  if not exists(select 1 from public.food_log_entries where id=recipe_entry and recipe_id is null and label='My stew' and kcal=520) then
    raise exception 'Recipe delete removed or changed the log entry';
  end if;

  -- Constraints.
  begin
    insert into public.food_log_entries(user_id,eaten_on,slot,source,food_id,label,kcal)
    values(auth.uid(),current_date,'lunch','quick',catalog_food,'x',10);
    raise exception 'Quick entry with a food accepted';
  exception when check_violation then null; end;
  begin
    insert into public.food_log_entries(user_id,eaten_on,slot,source,label,kcal)
    values(auth.uid(),current_date,'brunch','quick','x',10);
    raise exception 'Unknown slot accepted';
  exception when check_violation then null; end;
  begin
    insert into public.food_log_entries(user_id,eaten_on,slot,source,label,kcal)
    values(auth.uid(),current_date,'lunch','quick','   ',10);
    raise exception 'Blank label accepted';
  exception when check_violation then null; end;

  -- Another user's private food can't be linked (insert or update).
  begin
    insert into public.food_log_entries(user_id,eaten_on,slot,source,food_id,label,kcal)
    values(auth.uid(),current_date,'lunch','food',current_setting('test.private_food')::uuid,'x',10);
    raise exception 'Invisible food linked on insert';
  exception when foreign_key_violation then null; end;
  begin
    update public.food_log_entries set food_id=current_setting('test.private_food')::uuid where id=entry_id;
    raise exception 'Invisible food linked on update';
  exception when foreign_key_violation then null; end;

  -- Cannot write rows for someone else.
  begin
    insert into public.food_log_entries(user_id,eaten_on,slot,source,label,kcal)
    values(current_setting('test.other')::uuid,current_date,'lunch','quick','x',10);
    raise exception 'Cross-user insert accepted';
  exception when insufficient_privilege then null; end;
end;
$$;

select set_config('request.jwt.claim.sub',current_setting('test.other'),true);
do $$
begin
  if exists(select 1 from public.food_log_entries where user_id=current_setting('test.owner')::uuid) then
    raise exception 'Cross-user read';
  end if;
  update public.food_log_entries set kcal=1 where id=current_setting('test.entry')::uuid;
  if found then raise exception 'Cross-user update'; end if;
  delete from public.food_log_entries where id=current_setting('test.entry')::uuid;
  if found then raise exception 'Cross-user delete'; end if;
  -- Moving own row to another user is refused by WITH CHECK.
  insert into public.food_log_entries(user_id,eaten_on,slot,source,label,kcal) values(auth.uid(),current_date,'lunch','quick','x',10);
  begin
    update public.food_log_entries set user_id=current_setting('test.owner')::uuid where user_id=auth.uid();
    raise exception 'Row handed to another user';
  exception when insufficient_privilege then null; end;
end;
$$;

select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
do $$
begin
  delete from public.food_log_entries where id=current_setting('test.entry')::uuid;
  if not found then raise exception 'Owner delete failed'; end if;
end;
$$;

set local role anon;
do $$ begin
  begin perform 1 from public.food_log_entries; raise exception 'Anonymous food log access'; exception when insufficient_privilege then null; end;
end; $$;
rollback;
