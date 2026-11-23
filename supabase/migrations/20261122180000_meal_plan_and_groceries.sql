-- Nutrition roadmap S4: weekly meal plan, grocery lists, and meal-plan / grocery
-- reminders. Personal (not health) data: push payloads carry generic copy only,
-- logs and analytics ids only (docs/nutrition-roadmap.md §3). Included in the
-- account export; deleted with the account through the auth.users cascade.

-- ---------- meal_plan_entries ----------
-- S5 references this table with a composite (meal_plan_entry_id, user_id) FK.
create table if not exists public.meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_date date not null,
  slot text not null check (slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  position smallint not null default 0 check (position between 0 and 100),
  recipe_id uuid references public.recipes(id) on delete cascade,
  food_id uuid references public.foods(id) on delete cascade,
  -- Servings that will be cooked (drives groceries); recipes only.
  cook_servings numeric(4,2)
    check (cook_servings is null or cook_servings between 0.25 and 20),
  -- What this user eats (drives nutrition and logging).
  eaten_portions numeric(4,2) not null default 1
    check (eaten_portions between 0.25 and 20),
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meal_plan_entries_id_user_key unique (id, user_id),
  constraint meal_plan_entries_one_item check ((recipe_id is null) <> (food_id is null)),
  constraint meal_plan_entries_cook_only_recipe
    check (recipe_id is not null or cook_servings is null)
);
create index if not exists meal_plan_entries_user_date_idx
  on public.meal_plan_entries(user_id, plan_date);
create index if not exists meal_plan_entries_recipe_idx on public.meal_plan_entries(recipe_id);
create index if not exists meal_plan_entries_food_idx on public.meal_plan_entries(food_id);
drop trigger if exists meal_plan_entries_set_updated_at on public.meal_plan_entries;
create trigger meal_plan_entries_set_updated_at before update on public.meal_plan_entries
  for each row execute function public.set_updated_at();

-- ---------- grocery_lists ----------
create table if not exists public.grocery_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  generated_at timestamptz not null default now(),
  include_staples boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Also the index for the app's (user_id, week_start) lookup.
  constraint grocery_lists_user_week_key unique (user_id, week_start),
  constraint grocery_lists_id_user_key unique (id, user_id)
);
drop trigger if exists grocery_lists_set_updated_at on public.grocery_lists;
create trigger grocery_lists_set_updated_at before update on public.grocery_lists
  for each row execute function public.set_updated_at();

-- ---------- grocery_list_items ----------
create table if not exists public.grocery_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  food_id uuid references public.foods(id) on delete set null,
  -- Snapshot of the name so the list survives food edits and deletes.
  name_en text check (name_en is null or char_length(trim(name_en)) between 1 and 160),
  name_fa text check (name_fa is null or char_length(trim(name_fa)) between 1 and 160),
  grams numeric(7,1) check (grams is null or grams between 0 and 100000),
  count numeric(6,1) check (count is null or count between 0 and 10000),
  grocery_section text check (
    grocery_section is null or grocery_section in (
      'produce', 'poultry', 'meat', 'fish', 'dairy_eggs', 'bakery',
      'grains_legumes', 'nuts_dried', 'pantry', 'prepared', 'staples'
    )
  ),
  have boolean not null default false,
  bought boolean not null default false,
  is_manual boolean not null default false,
  position int not null default 0 check (position between 0 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint grocery_list_items_name_required check (coalesce(name_en, name_fa) is not null),
  constraint grocery_list_items_list_fkey foreign key (list_id, user_id)
    references public.grocery_lists(id, user_id) on delete cascade
);
create index if not exists grocery_list_items_list_idx
  on public.grocery_list_items(list_id, user_id);
create index if not exists grocery_list_items_user_idx on public.grocery_list_items(user_id);
create index if not exists grocery_list_items_food_idx on public.grocery_list_items(food_id);
drop trigger if exists grocery_list_items_set_updated_at on public.grocery_list_items;
create trigger grocery_list_items_set_updated_at before update on public.grocery_list_items
  for each row execute function public.set_updated_at();

-- ---------- RLS ----------
alter table public.meal_plan_entries enable row level security;
alter table public.grocery_lists enable row level security;
alter table public.grocery_list_items enable row level security;

drop policy if exists meal_plan_entries_select on public.meal_plan_entries;
drop policy if exists meal_plan_entries_insert on public.meal_plan_entries;
drop policy if exists meal_plan_entries_update on public.meal_plan_entries;
drop policy if exists meal_plan_entries_delete on public.meal_plan_entries;
create policy meal_plan_entries_select on public.meal_plan_entries for select to authenticated
  using ((select auth.uid()) = user_id);
-- The planned recipe or food must be visible to the caller (catalog or own):
-- the subqueries run under the recipes/foods RLS policies.
create policy meal_plan_entries_insert on public.meal_plan_entries for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (meal_plan_entries.recipe_id is null
      or exists (select 1 from public.recipes r where r.id = meal_plan_entries.recipe_id))
    and (meal_plan_entries.food_id is null
      or exists (select 1 from public.foods f where f.id = meal_plan_entries.food_id))
  );
create policy meal_plan_entries_update on public.meal_plan_entries for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (meal_plan_entries.recipe_id is null
      or exists (select 1 from public.recipes r where r.id = meal_plan_entries.recipe_id))
    and (meal_plan_entries.food_id is null
      or exists (select 1 from public.foods f where f.id = meal_plan_entries.food_id))
  );
create policy meal_plan_entries_delete on public.meal_plan_entries for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists grocery_lists_select on public.grocery_lists;
drop policy if exists grocery_lists_insert on public.grocery_lists;
drop policy if exists grocery_lists_update on public.grocery_lists;
drop policy if exists grocery_lists_delete on public.grocery_lists;
create policy grocery_lists_select on public.grocery_lists for select to authenticated
  using ((select auth.uid()) = user_id);
create policy grocery_lists_insert on public.grocery_lists for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy grocery_lists_update on public.grocery_lists for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy grocery_lists_delete on public.grocery_lists for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists grocery_list_items_select on public.grocery_list_items;
drop policy if exists grocery_list_items_insert on public.grocery_list_items;
drop policy if exists grocery_list_items_update on public.grocery_list_items;
drop policy if exists grocery_list_items_delete on public.grocery_list_items;
create policy grocery_list_items_select on public.grocery_list_items for select to authenticated
  using ((select auth.uid()) = user_id);
-- A linked food must be visible to the caller (catalog or own), like plan entries.
create policy grocery_list_items_insert on public.grocery_list_items for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (grocery_list_items.food_id is null
      or exists (select 1 from public.foods f where f.id = grocery_list_items.food_id))
  );
create policy grocery_list_items_update on public.grocery_list_items for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (grocery_list_items.food_id is null
      or exists (select 1 from public.foods f where f.id = grocery_list_items.food_id))
  );
create policy grocery_list_items_delete on public.grocery_list_items for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.meal_plan_entries, public.grocery_lists, public.grocery_list_items
  from anon, authenticated;
grant select, insert, update, delete
  on public.meal_plan_entries, public.grocery_lists, public.grocery_list_items to authenticated;
grant all on public.meal_plan_entries, public.grocery_lists, public.grocery_list_items
  to service_role;

-- ---------- save_grocery_list ----------
-- Writes a regenerated list in one transaction. Items with an id in this list are
-- updated in place (ids stay stable so queued offline ticks still land) and keep
-- their stored have/bought flags; other items (no id, or an id no longer in the
-- list) are inserted with a fresh id; items of the list missing from the payload
-- are deleted. Security invoker: RLS applies to every statement.
create or replace function public.save_grocery_list(
  p_week_start date,
  p_include_staples boolean,
  p_items jsonb
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_list uuid;
  v_keep uuid[];
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;
  if p_week_start is null or p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) > 500 then
    raise exception 'invalid_grocery_list';
  end if;

  insert into public.grocery_lists (user_id, week_start, include_staples, generated_at)
  values (v_user, p_week_start, coalesce(p_include_staples, false), now())
  on conflict (user_id, week_start) do update
    set include_staples = excluded.include_staples, generated_at = now()
  returning id into v_list;

  select coalesce(array_agg((item->>'id')::uuid), '{}')
    into v_keep
    from jsonb_array_elements(p_items) as item
    where nullif(item->>'id', '') is not null;

  delete from public.grocery_list_items
    where list_id = v_list and user_id = v_user and not (id = any (v_keep));
  -- Ids still present after the delete are the ones to update in place.
  select coalesce(array_agg(g.id), '{}')
    into v_keep
    from public.grocery_list_items g
    where g.list_id = v_list and g.user_id = v_user and g.id = any (v_keep);

  update public.grocery_list_items as g
    set food_id = nullif(i.item->>'food_id', '')::uuid,
        name_en = nullif(i.item->>'name_en', ''),
        name_fa = nullif(i.item->>'name_fa', ''),
        grams = (i.item->>'grams')::numeric,
        count = (i.item->>'count')::numeric,
        grocery_section = nullif(i.item->>'grocery_section', ''),
        is_manual = coalesce((i.item->>'is_manual')::boolean, false),
        position = (i.ord - 1)::int
    from jsonb_array_elements(p_items) with ordinality as i(item, ord)
    where nullif(i.item->>'id', '') is not null
      and g.id = (i.item->>'id')::uuid
      and g.list_id = v_list
      and g.user_id = v_user;

  insert into public.grocery_list_items (
    list_id, user_id, food_id, name_en, name_fa, grams, count,
    grocery_section, have, bought, is_manual, position
  )
  select v_list, v_user,
         nullif(i.item->>'food_id', '')::uuid,
         nullif(i.item->>'name_en', ''),
         nullif(i.item->>'name_fa', ''),
         (i.item->>'grams')::numeric,
         (i.item->>'count')::numeric,
         nullif(i.item->>'grocery_section', ''),
         coalesce((i.item->>'have')::boolean, false),
         coalesce((i.item->>'bought')::boolean, false),
         coalesce((i.item->>'is_manual')::boolean, false),
         (i.ord - 1)::int
    from jsonb_array_elements(p_items) with ordinality as i(item, ord)
    where nullif(i.item->>'id', '') is null
       or not ((i.item->>'id')::uuid = any (v_keep));

  return v_list;
end;
$$;
revoke all on function public.save_grocery_list(date, boolean, jsonb) from public, anon;
grant execute on function public.save_grocery_list(date, boolean, jsonb) to authenticated, service_role;

-- ---------- add_grocery_item ----------
-- Adds one manual item, creating the week's list if needed, without rewriting
-- the rest of the list (another device may have changed it). Security invoker.
create or replace function public.add_grocery_item(
  p_week_start date,
  p_name_en text,
  p_name_fa text
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_list uuid;
  v_item uuid;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;
  if p_week_start is null then
    raise exception 'invalid_grocery_list';
  end if;

  insert into public.grocery_lists (user_id, week_start)
  values (v_user, p_week_start)
  on conflict (user_id, week_start) do nothing;
  select id into v_list from public.grocery_lists
    where user_id = v_user and week_start = p_week_start;
  -- Same cap as save_grocery_list, so a full list can still be regenerated.
  if (select count(*) from public.grocery_list_items where list_id = v_list) >= 500 then
    raise exception 'grocery_list_full';
  end if;

  insert into public.grocery_list_items (list_id, user_id, name_en, name_fa, is_manual, position)
  values (
    v_list, v_user, nullif(trim(p_name_en), ''), nullif(trim(p_name_fa), ''), true,
    least(10000, coalesce(
      (select max(position) + 1 from public.grocery_list_items where list_id = v_list), 0))
  )
  returning id into v_item;
  return v_item;
end;
$$;
revoke all on function public.add_grocery_item(date, text, text) from public, anon;
grant execute on function public.add_grocery_item(date, text, text) to authenticated, service_role;

-- ---------- Reminders ----------
-- Day of week uses 0 = Sunday … 6 = Saturday (same as body_profiles.week_starts_on).
alter table public.notification_preferences
  add column if not exists meal_plan_enabled boolean not null default false,
  add column if not exists meal_plan_dow smallint,
  add column if not exists meal_plan_time time,
  add column if not exists grocery_enabled boolean not null default false,
  add column if not exists grocery_dow smallint,
  add column if not exists grocery_time time;

alter table public.notification_preferences
  drop constraint if exists notification_preferences_meal_plan_schedule,
  drop constraint if exists notification_preferences_grocery_schedule;
alter table public.notification_preferences
  add constraint notification_preferences_meal_plan_schedule check (
    (meal_plan_dow is null or meal_plan_dow between 0 and 6)
    and (not meal_plan_enabled or (meal_plan_dow is not null and meal_plan_time is not null))
  ),
  add constraint notification_preferences_grocery_schedule check (
    (grocery_dow is null or grocery_dow between 0 and 6)
    and (not grocery_enabled or (grocery_dow is not null and grocery_time is not null))
  );

alter table public.push_deliveries drop constraint if exists push_deliveries_category_check;
alter table public.push_deliveries add constraint push_deliveries_category_check
  check (category in ('checkin', 'health', 'workout', 'meal_plan', 'grocery'));
