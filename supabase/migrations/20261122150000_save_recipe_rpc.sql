-- Nutrition roadmap S3: save a user's recipe and its ingredients in one transaction.
-- Used by the recipe editor and by "Save to my recipes" (copy of a starter recipe,
-- p_recipe_id null + copied_from). Personal data: ids only in logs/analytics,
-- never in push payloads (docs/nutrition-roadmap.md §3).
--
-- p_recipe: {title_en, title_fa, category, servings, steps_en[], steps_fa[], tip_en,
--   tip_fa, tags[], copied_from, suggested_side_food_id, suggested_side_grams}
-- p_ingredients: JSON array of {food_id, name_en, name_fa, grams, amount_en,
--   amount_fa, is_staple}; array order is the position.
-- Security invoker: RLS limits every statement to the caller's rows, so catalog
-- recipes (owner_id null) can never be updated; table checks and the existing
-- check_nutrition_references trigger validate values and food/recipe ownership.
create or replace function public.save_recipe(p_recipe_id uuid, p_recipe jsonb, p_ingredients jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if p_recipe is null or jsonb_typeof(p_recipe) <> 'object' then
    raise exception 'Invalid recipe' using errcode = '22023';
  end if;
  if p_ingredients is null or jsonb_typeof(p_ingredients) <> 'array' or jsonb_array_length(p_ingredients) > 60 then
    raise exception 'Invalid ingredient list' using errcode = '22023';
  end if;

  if p_recipe_id is null then
    insert into public.recipes
      (owner_id, title_en, title_fa, category, servings, steps_en, steps_fa, tip_en, tip_fa,
       tags, copied_from, suggested_side_food_id, suggested_side_grams)
    values (
      v_user,
      nullif(trim(p_recipe->>'title_en'), ''),
      nullif(trim(p_recipe->>'title_fa'), ''),
      p_recipe->>'category',
      coalesce((p_recipe->>'servings')::integer, 1),
      coalesce(array(select jsonb_array_elements_text(coalesce(p_recipe->'steps_en', '[]'))), '{}'),
      coalesce(array(select jsonb_array_elements_text(coalesce(p_recipe->'steps_fa', '[]'))), '{}'),
      nullif(trim(p_recipe->>'tip_en'), ''),
      nullif(trim(p_recipe->>'tip_fa'), ''),
      coalesce(array(select jsonb_array_elements_text(coalesce(p_recipe->'tags', '[]'))), '{}'),
      nullif(p_recipe->>'copied_from', '')::uuid,
      nullif(p_recipe->>'suggested_side_food_id', '')::uuid,
      (p_recipe->>'suggested_side_grams')::numeric
    )
    returning id into v_id;
  else
    update public.recipes set
      title_en = nullif(trim(p_recipe->>'title_en'), ''),
      title_fa = nullif(trim(p_recipe->>'title_fa'), ''),
      category = p_recipe->>'category',
      servings = coalesce((p_recipe->>'servings')::integer, 1),
      steps_en = coalesce(array(select jsonb_array_elements_text(coalesce(p_recipe->'steps_en', '[]'))), '{}'),
      steps_fa = coalesce(array(select jsonb_array_elements_text(coalesce(p_recipe->'steps_fa', '[]'))), '{}'),
      tip_en = nullif(trim(p_recipe->>'tip_en'), ''),
      tip_fa = nullif(trim(p_recipe->>'tip_fa'), ''),
      tags = coalesce(array(select jsonb_array_elements_text(coalesce(p_recipe->'tags', '[]'))), '{}'),
      suggested_side_food_id = nullif(p_recipe->>'suggested_side_food_id', '')::uuid,
      suggested_side_grams = (p_recipe->>'suggested_side_grams')::numeric
    where id = p_recipe_id and owner_id = v_user
    returning id into v_id;
    if v_id is null then
      raise exception 'Recipe not found' using errcode = '42501';
    end if;
    delete from public.recipe_ingredients where recipe_id = v_id and owner_id = v_user;
  end if;

  insert into public.recipe_ingredients
    (recipe_id, owner_id, position, food_id, name_en, name_fa, grams, amount_en, amount_fa, is_staple)
  select
    v_id, v_user, (ord - 1)::integer,
    nullif(item->>'food_id', '')::uuid,
    nullif(trim(item->>'name_en'), ''),
    nullif(trim(item->>'name_fa'), ''),
    coalesce((item->>'grams')::numeric, 0),
    nullif(trim(item->>'amount_en'), ''),
    nullif(trim(item->>'amount_fa'), ''),
    coalesce((item->>'is_staple')::boolean, false)
  from jsonb_array_elements(p_ingredients) with ordinality as t(item, ord);

  return v_id;
end;
$$;
revoke all on function public.save_recipe(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_recipe(uuid, jsonb, jsonb) to authenticated, service_role;
