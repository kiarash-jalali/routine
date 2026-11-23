-- Nutrition roadmap S5: food log.
-- HEALTH DATA (diet): never in push payloads, logs, analytics, the offline
-- snapshot or the planning-agent snapshot. Included in account export; deleted
-- with the account through the auth.users cascade.
-- Entries snapshot the label and macros when written, so editing or deleting a
-- food or recipe never rewrites history. recipe_id / food_id only power
-- "Recent" and are set null when the item is deleted.

create table public.food_log_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  eaten_on date not null,
  slot text not null check (slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  source text not null check (source in ('plan', 'recipe', 'food', 'quick')),
  -- The composite FK to meal_plan_entries(id, user_id) is added after S4
  -- (meal plan) merges; until then nothing writes this column.
  meal_plan_entry_id uuid,
  recipe_id uuid references public.recipes(id) on delete set null,
  food_id uuid references public.foods(id) on delete set null,
  portions numeric(4,2) check (portions is null or portions between 0.25 and 20),
  grams numeric(6,1) check (grams is null or (grams > 0 and grams <= 5000)),
  label text not null check (char_length(btrim(label)) between 1 and 200),
  kcal int not null check (kcal between 0 and 10000),
  protein numeric(5,1) not null default 0 check (protein between 0 and 1000),
  fat numeric(5,1) not null default 0 check (fat between 0 and 1000),
  carbs numeric(5,1) not null default 0 check (carbs between 0 and 1000),
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint food_log_entries_one_item check (recipe_id is null or food_id is null),
  constraint food_log_entries_quick_has_no_item
    check (source <> 'quick' or (recipe_id is null and food_id is null))
);
create trigger food_log_entries_set_updated_at before update on public.food_log_entries
  for each row execute function public.set_updated_at();

create index food_log_entries_user_day_idx on public.food_log_entries(user_id, eaten_on);
create index food_log_entries_recipe_idx on public.food_log_entries(recipe_id)
  where recipe_id is not null;
create index food_log_entries_food_idx on public.food_log_entries(food_id)
  where food_id is not null;

-- foods and recipes mix catalog rows (owner_id null) with user rows, so a
-- composite FK can't express "visible to this user". Instead the linked item
-- must be visible to the writer. Security invoker: the selects run under the
-- caller's RLS. FK "set null" actions write null and skip the check.
create or replace function public.food_log_entries_check_item() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.food_id is not null
     and (tg_op = 'INSERT' or new.food_id is distinct from old.food_id)
     and not exists (select 1 from public.foods f where f.id = new.food_id) then
    raise exception 'food_log_item_not_visible' using errcode = '23503';
  end if;
  if new.recipe_id is not null
     and (tg_op = 'INSERT' or new.recipe_id is distinct from old.recipe_id)
     and not exists (select 1 from public.recipes r where r.id = new.recipe_id) then
    raise exception 'food_log_item_not_visible' using errcode = '23503';
  end if;
  return new;
end;
$$;
revoke all on function public.food_log_entries_check_item() from public, anon, authenticated;
create trigger food_log_entries_check_item
  before insert or update of food_id, recipe_id on public.food_log_entries
  for each row execute function public.food_log_entries_check_item();

alter table public.food_log_entries enable row level security;

create policy food_log_entries_select on public.food_log_entries for select to authenticated using ((select auth.uid()) = user_id);
create policy food_log_entries_insert on public.food_log_entries for insert to authenticated with check ((select auth.uid()) = user_id);
create policy food_log_entries_update on public.food_log_entries for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy food_log_entries_delete on public.food_log_entries for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.food_log_entries from anon, authenticated;
grant select, insert, update, delete on public.food_log_entries to authenticated;
grant all on public.food_log_entries to service_role;
