-- Nutrition roadmap S1: food catalog, recipes and recipe ingredients.
-- Catalog rows (owner_id is null) are shared read-only data written only by
-- migrations. User rows (owner_id = auth.uid()) are personal data: ids only in
-- logs/analytics, never in push payloads (docs/nutrition-roadmap.md §3).

create extension if not exists pg_trgm with schema extensions;

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  slug text unique check (slug is null or slug ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  kind text not null check (kind in ('ingredient','dish')),
  region text check (region in ('iran','global')),
  category text check (category in ('rice','stew','kebab','kuku','soup','side','salad','dessert','bread','breakfast','snack','drink','fastfood','pasta','pizza','meat')),
  name_en text check (name_en is null or char_length(trim(name_en)) between 1 and 160),
  name_fa text check (name_fa is null or char_length(trim(name_fa)) between 1 and 160),
  kcal_100g numeric(6,1) not null default 0 check (kcal_100g between 0 and 950),
  protein_100g numeric(6,1) not null default 0 check (protein_100g between 0 and 100),
  fat_100g numeric(6,1) not null default 0 check (fat_100g between 0 and 100),
  carbs_100g numeric(6,1) not null default 0 check (carbs_100g between 0 and 100),
  fiber_100g numeric(5,1) not null default 0 check (fiber_100g between 0 and 100),
  serving_grams numeric(6,1) check (serving_grams is null or serving_grams > 0 and serving_grams <= 5000),
  serving_unit text check (serving_unit is null or char_length(trim(serving_unit)) between 1 and 40),
  serving_label_en text check (serving_label_en is null or char_length(serving_label_en) <= 80),
  serving_label_fa text check (serving_label_fa is null or char_length(serving_label_fa) <= 80),
  count_unit_grams numeric(6,1) check (count_unit_grams is null or count_unit_grams > 0 and count_unit_grams <= 5000),
  grocery_section text check (grocery_section in ('produce','poultry','meat','fish','dairy_eggs','bakery','grains_legumes','nuts_dried','pantry','prepared')),
  is_staple boolean not null default false,
  tags text[] not null default '{}' check (tags <@ array['red_meat','organ_meat','fish','seafood','legume','high_sugar','fried','high_salt']::text[]),
  source text not null default 'user' check (source in ('user','approximate')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (coalesce(name_en, name_fa) is not null),
  check (protein_100g + fat_100g + carbs_100g <= 100),
  -- Catalog rows carry a slug; user rows never do.
  check ((owner_id is null) = (slug is not null))
);
create index foods_owner_idx on public.foods(owner_id);
create index foods_kind_idx on public.foods(kind);
create index foods_name_en_trgm_idx on public.foods using gin (lower(name_en) extensions.gin_trgm_ops);
create index foods_name_fa_trgm_idx on public.foods using gin (lower(name_fa) extensions.gin_trgm_ops);
create trigger foods_set_updated_at before update on public.foods
  for each row execute function public.set_updated_at();

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  slug text unique check (slug is null or slug ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  title_en text check (title_en is null or char_length(trim(title_en)) between 1 and 160),
  title_fa text check (title_fa is null or char_length(trim(title_fa)) between 1 and 160),
  category text not null check (category in ('breakfast','rice','main','soup','side','snack')),
  servings integer not null default 1 check (servings between 1 and 20),
  steps_en text[] not null default '{}' check (cardinality(steps_en) <= 30 and char_length(array_to_string(steps_en, '')) <= 8000),
  steps_fa text[] not null default '{}' check (cardinality(steps_fa) <= 30 and char_length(array_to_string(steps_fa, '')) <= 8000),
  tip_en text check (tip_en is null or char_length(tip_en) <= 600),
  tip_fa text check (tip_fa is null or char_length(tip_fa) <= 600),
  tags text[] not null default '{}' check (cardinality(tags) <= 12 and char_length(array_to_string(tags, '')) <= 300),
  suggested_side_food_id uuid references public.foods(id) on delete set null,
  suggested_side_grams numeric(6,1) check (suggested_side_grams is null or suggested_side_grams between 0 and 5000),
  copied_from uuid references public.recipes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (coalesce(title_en, title_fa) is not null),
  check ((owner_id is null) = (slug is not null)),
  unique (id, owner_id)
);
create index recipes_owner_idx on public.recipes(owner_id);
create index recipes_side_food_idx on public.recipes(suggested_side_food_id);
create index recipes_copied_from_idx on public.recipes(copied_from);
create trigger recipes_set_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  owner_id uuid,
  position integer not null default 0 check (position between 0 and 99),
  food_id uuid references public.foods(id) on delete set null,
  name_en text check (name_en is null or char_length(trim(name_en)) between 1 and 160),
  name_fa text check (name_fa is null or char_length(trim(name_fa)) between 1 and 160),
  grams numeric(6,1) not null default 0 check (grams between 0 and 5000),
  amount_en text check (amount_en is null or char_length(amount_en) <= 80),
  amount_fa text check (amount_fa is null or char_length(amount_fa) <= 80),
  is_staple boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (food_id is not null or coalesce(name_en, name_fa) is not null),
  -- User rows must belong to a recipe owned by the same user. (Catalog rows
  -- have a null owner on both sides and are covered by the plain FK above.)
  foreign key (recipe_id, owner_id) references public.recipes(id, owner_id) on delete cascade
);
create index recipe_ingredients_recipe_owner_idx on public.recipe_ingredients(recipe_id, owner_id);
create index recipe_ingredients_recipe_position_idx on public.recipe_ingredients(recipe_id, position);
create index recipe_ingredients_food_idx on public.recipe_ingredients(food_id);
create trigger recipe_ingredients_set_updated_at before update on public.recipe_ingredients
  for each row execute function public.set_updated_at();

-- A user row may only point at catalog foods/recipes or the same user's own.
-- Security invoker: RLS hides other users' rows, so "not found" also rejects.
create function public.check_nutrition_references() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  ref_owner uuid;
begin
  if tg_table_name = 'recipe_ingredients' then
    if new.food_id is not null then
      select owner_id into ref_owner from public.foods where id = new.food_id;
      if not found or (ref_owner is not null and ref_owner is distinct from new.owner_id) then
        raise exception 'Food belongs to another user' using errcode = '42501';
      end if;
    end if;
  elsif tg_table_name = 'recipes' then
    if new.suggested_side_food_id is not null then
      select owner_id into ref_owner from public.foods where id = new.suggested_side_food_id;
      if not found or (ref_owner is not null and ref_owner is distinct from new.owner_id) then
        raise exception 'Food belongs to another user' using errcode = '42501';
      end if;
    end if;
    if new.copied_from is not null then
      select owner_id into ref_owner from public.recipes where id = new.copied_from;
      if not found or (ref_owner is not null and ref_owner is distinct from new.owner_id) then
        raise exception 'Recipe belongs to another user' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.check_nutrition_references() from public, anon, authenticated;
create trigger recipe_ingredients_check_refs before insert or update on public.recipe_ingredients
  for each row execute function public.check_nutrition_references();
create trigger recipes_check_refs before insert or update on public.recipes
  for each row execute function public.check_nutrition_references();

alter table public.foods enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;

create policy foods_select on public.foods for select to authenticated
  using (owner_id is null or (select auth.uid()) = owner_id);
create policy foods_insert on public.foods for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy foods_update on public.foods for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy foods_delete on public.foods for delete to authenticated
  using ((select auth.uid()) = owner_id);

create policy recipes_select on public.recipes for select to authenticated
  using (owner_id is null or (select auth.uid()) = owner_id);
create policy recipes_insert on public.recipes for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy recipes_update on public.recipes for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy recipes_delete on public.recipes for delete to authenticated
  using ((select auth.uid()) = owner_id);

create policy recipe_ingredients_select on public.recipe_ingredients for select to authenticated
  using (owner_id is null or (select auth.uid()) = owner_id);
create policy recipe_ingredients_insert on public.recipe_ingredients for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy recipe_ingredients_update on public.recipe_ingredients for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy recipe_ingredients_delete on public.recipe_ingredients for delete to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on public.foods, public.recipes, public.recipe_ingredients from anon, authenticated;
grant select, insert, update, delete on public.foods, public.recipes, public.recipe_ingredients to authenticated;
grant all on public.foods, public.recipes, public.recipe_ingredients to service_role;
