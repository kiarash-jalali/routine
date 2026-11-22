# Nutrition, body and meal-planning roadmap

Status: approved spec, not built yet (November 2026). Read this whole file before
working on any feature it covers, together with `CLAUDE.md`,
`docs/application-architecture.md` and `docs/life-management-phases.md`.

This file is the source of truth for scope, data model, calculations and
acceptance criteria. If code and this file disagree, stop and ask. If you change
a decision, update this file in the same PR.

---

## 1. What we are building

Rootine gains five connected capabilities, built for any user (no personal
values are hard-coded):

| # | Capability | One-line goal |
|---|---|---|
| A | Body profile and log | Height, goal, daily weight and weekly waist give BMI, waist-to-height, a calorie target and a protein target or limit. |
| B | Food catalog and recipes | A bilingual catalog (ingredients + 300 dishes) and recipes with per-portion nutrition. |
| C | Weekly meal plan, grocery list, reminders | Plan a week of meals; the app builds a grocery list from it and reminds the user to plan and to shop. |
| D | Food logging | Log meals in one tap from the plan, or by search / quick calories; Today shows calories and protein against targets. |
| E | Structured workouts | Exercises with sets × reps, per-set logging and progression hints, replacing the free-text exercise field. |
| F | Weekly review and adaptive reminders | A weekly summary with a suggested calorie adjustment, and reminders that back off when ignored. |

Medication reminders (Health) and routines already exist and are reused as they
are: daily pills live in Health, daily habits (posture routine, walks) are
routines.

### Product rules (apply to every screen)

1. Discipline without pressure. No shaming copy, no red streak-loss banners, no
   comparisons with other people.
2. Every new step must remove a bigger one. Logging a planned meal is one tap.
   Planning a week can start from "copy last week".
3. The app informs, it does not diagnose. Wording such as "above the range
   linked to higher health risk" is fine; "you have X" is not. Show a short
   "not medical advice" note on the body and targets screens.
4. Users with medical limits stay in control: a protein limit or calorie target
   entered by the user (for example from their clinician) always wins over the
   app's calculation and is labelled as user-set.
5. English and Persian from day one, RTL checked, food names in both languages.

### Out of scope for v1

Barcode scanning, photo recognition, micronutrients beyond fiber, social
features, AI meal-plan generation (possible later through the agent proposal
boundary in `docs/agent-architecture.md`), wearable sync, Jalali calendar
display (keep Gregorian, the existing format).

---

## 2. Build slices and order

Slices are independent PRs. Arrows are hard dependencies. Slices on the same
line can be built in parallel sessions.

```
S0 Today refactor ─┐
S1 Catalog schema + seed ─┬─> S3 Recipes UI ─┬─> S4 Meal plan + groceries + reminders
                          │                  └─> S5 Food log + Today totals
S2 Body profile + log ────┴──────────────────────> S5
S6 Structured workouts (independent)
S7a Notification open tracking (independent) ──> S7b Adaptive reminders
S2 + S5 ──> S7c Weekly review
```

Recommended order with two sessions in parallel:
1. S0, S1, S6, S7a
2. S2, S3
3. S4, S5
4. S7b, S7c

Each slice section below lists scope, schema, screens, acceptance criteria and
tests. Use the `db-change` skill for every schema change and `/ship` for every
PR.

---

## 3. Shared rules for all new tables

- RLS enabled before any grant. Owner policies for SELECT, INSERT, UPDATE,
  DELETE using `(select auth.uid()) = user_id`; UPDATE has both USING and WITH
  CHECK. No grants to `anon`.
- Child rows reference parents with a composite foreign key
  `(parent_id, user_id)` so a user can never attach rows to another user's
  parent (same pattern as medication and workout tables).
- Catalog rows shared by all users have `owner_id is null`. Authenticated users
  can SELECT them; nobody can write them except migrations (service role).
  User-owned rows in the same table have `owner_id = auth.uid()`.
- `created_at timestamptz not null default now()`, `updated_at` with the
  existing update trigger where rows are edited.
- Text length checks on every free-text column (follow existing `char_length`
  patterns). Numeric ranges checked (weights 20–400 kg, waist 40–250 cm, grams
  0–5000, portions 0.25–20).
- Index every foreign key and every column used in a filter or order by.
- Regenerate `src/types/database.ts` after each migration and run the security
  and performance advisors.
- Extend `supabase/tests/` with a rolled-back RLS test per new table family:
  owner CRUD works, cross-user read/write/foreign key fails, anon has nothing,
  catalog rows are read-only.

### Health-data classification

| Table | Class | Push payload | Logs/analytics | Offline snapshot | Agent snapshot | Export | Delete with account |
|---|---|---|---|---|---|---|---|
| body_profiles, body_measurements | health | never | never | never | never | yes | yes |
| food_log_entries | health (diet) | never | never | never | never | yes | yes |
| meal_plan_entries | personal | generic copy only | ids only | today's entries, read-only | allowed later via proposals | yes | yes |
| recipes (user-owned), recipe_ingredients | personal | never | ids only | no | allowed later | yes | yes |
| grocery_lists, grocery_list_items | personal | generic copy only | ids only | current week, editable | no | yes | yes |
| foods (user-owned) | personal | never | ids only | no | no | yes | yes |
| workout_plan_exercises, workout_set_logs | personal | generic copy only | ids only | no | existing workout rules | yes | yes |

Update `src/app/api/account/export/route.ts` and account deletion in the slice
that adds each table.

---

## 4. Calculations (`src/lib/nutrition/`)

One module, pure functions, unit-tested with `node --test`. UI and server both
import it; no duplicated formulas elsewhere.

### 4.1 Body metrics

- `bmi = weight_kg / (height_m ^ 2)`, one decimal.
- `waistToHeight = waist_cm / height_cm`, two decimals. Display bands:
  `< 0.5` "healthy range", `0.5–0.6` "increased risk", `≥ 0.6` "high risk"
  (informational wording only).
- Trend weight: exponentially weighted moving average of daily weigh-ins
  (`alpha = 0.25`), plus the plain 7-day average for the weekly view. Missing
  days are skipped, not interpolated.
- Observed rate (kg/week): slope of a least-squares line through the last 14–28
  days of weigh-ins; needs at least 8 weigh-ins over 14+ days, otherwise
  `null` ("not enough data yet").

### 4.2 Energy target

- BMR, Mifflin–St Jeor: men `10W + 6.25H − 5A + 5`, women `10W + 6.25H − 5A − 161`
  (W kg, H cm, A years). If sex is not given, use the average of both.
- Activity multipliers: sedentary 1.2, light 1.375, moderate 1.55, very active 1.725.
- `tdee = bmr × multiplier`, rounded to 10 kcal.
- Goal modes: `lose`, `maintain`, `gain`. Rate options for lose: 0.25, 0.5,
  0.75, 1.0 kg/week; for gain: 0.25, 0.5.
- Daily deficit = `rate × 7700 / 7`. Clamp the deficit to 25% of TDEE and the
  target to a floor of 1500 kcal (men) / 1200 kcal (women / unspecified 1350).
  When clamped, show why ("we capped this to keep it safe").
- `kcal_target_override` on the profile replaces the calculated target and is
  labelled "set by you".

### 4.3 Protein

- Reference weight = goal weight if set, otherwise the weight at BMI 25 for the
  user's height, but never above current weight.
- Mode `auto`: target `1.2 g × reference weight` (rounded to 5 g).
- Mode `limit`: the user enters a maximum in grams (for example from a
  clinician). The app shows protein as "x of y g limit", turns the bar amber
  above 90% and never suggests exceeding it. Copy explains this mode exists for
  people with medical protein limits.
- Mode `custom`: the user enters a target.

### 4.4 Food nutrition

- Every food stores per-100 g values: kcal, protein, fat, carbs, fiber.
- Food in grams: `value × grams / 100`.
- Recipe per serving: `Σ(ingredient food per-100 × grams / 100) / servings`.
  Ingredients without a food (spices, "salt to taste") contribute 0.
- A log entry stores a snapshot of kcal, protein, fat, carbs at the time it is
  written, so later edits to a food or recipe never rewrite history.
- Rounding: kcal to integers, macros to 1 decimal in storage, integers in the UI.

### 4.5 Weekly adjustment suggestion (S7c)

Using the observed rate from 4.1 compared with the goal rate:

| Observed vs goal (lose mode) | Suggestion |
|---|---|
| observed loss < 0.3 kg/week for 2+ weeks | lower target by 150 kcal (never below the floor) or add 2,000 daily steps |
| observed loss within 0.3 kg/week and 1.0 kg/week | keep going |
| observed loss > 1.0 kg/week after the first 3 weeks | raise target by 150 kcal |

Suggestions are never applied automatically; the user accepts or dismisses.
Accepted changes are stored in `target_adjustments`.

---

## 5. Slice details

### S0 — Today refactor (no schema)

Scope: split `src/app/dashboard/DashboardClient.tsx` (~1,260 lines) into section
components under `src/components/today/` (tasks, routines, health, workouts,
moments) with a small shell that loads data and orders sections. Behaviour,
markup output and translations stay identical.

Acceptance:
- [ ] DashboardClient under 300 lines; each section in its own file.
- [ ] A section registry or ordered list makes adding "Weigh-in" and "Meals"
      sections a one-line change.
- [ ] `npm run verify` passes; manual check of Today in en and fa, online and
      offline, matches before/after screenshots.

### S1 — Catalog schema and seed

Tables:

`foods`
- `id uuid pk`, `owner_id uuid null references auth.users on delete cascade`
- `slug text unique` (required for catalog rows, null for user rows)
- `kind text check (kind in ('ingredient','dish'))`
- `region text null check (region in ('iran','global'))`
- `category text null` (dish categories from the seed: rice, stew, kebab, kuku,
  soup, side, salad, dessert, bread, breakfast, snack, drink, fastfood, pasta,
  pizza, meat)
- `name_en text`, `name_fa text` (at least one required)
- `kcal_100g numeric(6,1)`, `protein_100g`, `fat_100g`, `carbs_100g`,
  `fiber_100g numeric(5,1)` (all ≥ 0; protein+fat+carbs ≤ 100)
- `serving_grams numeric(6,1) null`, `serving_unit text null`,
  `serving_label_en text null`, `serving_label_fa text null`
- `count_unit_grams numeric(6,1) null` (for things bought by count: an egg is
  50 g, so the grocery list can show "6 eggs")
- `grocery_section text null` (produce, poultry, meat, fish, dairy_eggs,
  bakery, grains_legumes, nuts_dried, pantry, prepared)
- `is_staple boolean not null default false` (oil, spices, rice: hidden from
  grocery lists unless the user turns staples on)
- `tags text[] not null default '{}'` (red_meat, organ_meat, fish, seafood,
  legume, high_sugar, fried, high_salt)
- `source text not null default 'user'` ('approximate' for the seed)
- Policies: select where `owner_id is null or owner_id = auth.uid()`; insert,
  update, delete only where `owner_id = auth.uid()`.
- Indexes: `owner_id`, `kind`, trigram or `lower(name)` indexes on both names
  for search (`pg_trgm` if available; otherwise `ilike` on lowered names).

`recipes`
- `id`, `owner_id null` (null = starter recipe), `slug unique null`,
  `title_en`, `title_fa`, `category` (breakfast, rice, main, soup, side, snack),
  `servings int check (servings between 1 and 20)`,
  `steps_en text[]`, `steps_fa text[]`, `tip_en`, `tip_fa`,
  `tags text[]`, `suggested_side_food_id uuid null`, `suggested_side_grams numeric null`,
  `copied_from uuid null references recipes(id) on delete set null`.
- Starter recipes are read-only; "Save to my recipes" copies the recipe and its
  ingredients into user-owned rows.

`recipe_ingredients`
- `id`, `recipe_id`, `owner_id null` (matches the recipe), `position int`,
  `food_id uuid null references foods`, `name_en`, `name_fa` (display name;
  required when `food_id` is null), `grams numeric not null default 0`,
  `amount_en text null`, `amount_fa text null` (household measure such as
  "1 tbsp"), `is_staple boolean not null default false`.
- Composite FK `(recipe_id, owner_id)` for user rows; catalog rows have both null owners.

Seed:
- `supabase/seed/food-catalog.json`: 53 ingredients (`slug` `ing-…`) and 300
  dishes (150 Iranian `ir-…`, 150 global `gl-…`), bilingual names, serving
  sizes, per-100 g and per-serving values, tags. Values are approximate
  (kcal = 4·protein + 4·carbs + 9·fat).
- `supabase/seed/starter-recipes.json`: 40 Persian starter recipes. Ingredients
  reference catalog slugs; spices/salt rows have `food_slug: null` and
  `is_staple: true`. `steps_en` and `tip_en` are null: translate them to
  English in this slice (keep Persian as written), and review the translation.
- Write `scripts/generate-food-seed.mjs` that reads both JSON files and writes a
  migration `supabase/migrations/<timestamp>_seed_food_catalog.sql` with
  idempotent `insert … on conflict (slug) do update`. Commit the generated SQL.
  Re-running the script with changed JSON produces a new migration, never an
  edit to an old one.

Acceptance:
- [ ] Catalog: 353 foods, 40 recipes, ingredient links resolved (no dangling slugs).
- [ ] A test recomputes per-serving nutrition for 5 starter recipes and matches
      `per_portion_incl_side` in the seed within 2%.
- [ ] RLS test: a user can read catalog rows, cannot modify them, can CRUD own foods.

### S2 — Body profile and log

Tables:

`body_profiles` (one row per user)
- `user_id pk`, `sex text null check (sex in ('male','female'))`,
  `birth_year int`, `height_cm numeric(5,1)`,
  `activity_level text check (activity_level in ('sedentary','light','moderate','very_active'))`,
  `goal_mode text check (goal_mode in ('lose','maintain','gain'))`,
  `goal_weight_kg numeric(5,1) null`, `goal_rate_kg_week numeric(3,2) null`,
  `kcal_target_override int null`,
  `protein_mode text check (protein_mode in ('auto','limit','custom')) default 'auto'`,
  `protein_grams int null` (the limit or custom target),
  `week_starts_on smallint not null default 6` (0 Sunday … 6 Saturday; default
  from locale: Saturday for fa, Monday for en), `updated_at`.

`body_measurements`
- `id`, `user_id`, `measured_on date`, `weight_kg numeric(5,2) null`,
  `waist_cm numeric(5,1) null`, `body_fat_pct numeric(4,1) null`,
  `note text null`; unique `(user_id, measured_on)`; at least one value required.

`target_adjustments` (written in S7c, created here)
- `id`, `user_id`, `effective_from date`, `delta_kcal int`, `reason text`,
  `accepted_at timestamptz`.

Screens:
- `/body`: profile form (first visit is a 4-step setup: height and birth year →
  current weight and waist → goal and rate → protein mode), current metrics
  (weight trend, BMI, waist-to-height with band, calorie target, protein
  target/limit), a chart of daily weights with the trend line and weekly
  average, measurement history with edit/delete, and a "not medical advice" note.
- Today: a compact weigh-in card that shows until today's weight is entered
  (dismissible for the day). Waist prompt only on the user's week start day.
- Navigation: reach `/body` from Health (section link) and from the Today
  weigh-in card. Do not add a nav tab in this slice.
- Optional CSV import on `/body` (date, weight, waist) for users moving from a
  spreadsheet.

Acceptance:
- [ ] Targets match the formulas in section 4 for 6 fixture profiles (unit tests).
- [ ] Override and limit modes are labelled "set by you" and win over calculations.
- [ ] Weigh-in from Today takes one field and one tap; editing the same day updates, not duplicates.
- [ ] Body data never appears in push payloads, logs, offline snapshot or agent snapshot (test like the existing medication ones).
- [ ] en/fa parity, RTL chart labels correct, 390 px mobile has no overflow.

### S3 — Recipes UI

Status: built (`/food`, `/food/recipes/[id]`, editor, Foods tab).

Screens:
- `/food` hub with tabs: Plan (S4), Recipes, Groceries (S4), Foods. Until S4
  ships, Plan and Groceries tabs are hidden.
- Recipes list: starter + my recipes, filter by category and tags, search by
  name in both languages; each card shows kcal and protein per serving.
- Recipe detail: ingredients with household amounts and grams, scaled by a
  servings stepper; steps; tip; tags shown as small chips (red meat, fish,
  legume, high sugar…); "Save to my recipes" for starter recipes; edit/delete
  for own recipes.
- Recipe editor: title (both languages optional, at least one), servings,
  ingredients picked from foods search with grams (and optional household
  text), free-text staples, steps reorderable, live per-serving nutrition.
- Foods tab: search the catalog, view a food's per-100 g and per-serving
  values, create/edit own foods.
- Navigation: add a "Food" nav tab. Decided (November 2026): a seventh tab
  between History and Health. At 360 px each tab is 48 px wide and the longest
  label needs about 41 px; the mobile grid reads the tab count from `--nav-count`.
- Saving: recipe and ingredients are written in one transaction by the
  security-invoker `save_recipe(p_recipe_id, p_recipe, p_ingredients)` RPC
  (`p_recipe_id` null inserts; "Save to my recipes" passes `copied_from`).
  Lists and search run client-side over the visible catalog (`src/lib/nutrition/search.ts`).
  Steps are edited as one step per line (reorder by moving lines) rather than
  drag handles; ingredient rows have up/down buttons.

Acceptance:
- [ ] Servings stepper rescales amounts and nutrition correctly.
- [ ] Saving a starter recipe creates user-owned copies of recipe and ingredients; edits never touch catalog rows.
- [ ] Search finds "قورمه" and "ghormeh" alike.

### S4 — Weekly meal plan, grocery list and reminders

Tables:

`meal_plan_entries`
- `id`, `user_id`, `plan_date date`,
  `slot text check (slot in ('breakfast','lunch','dinner','snack'))`,
  `position smallint`, `recipe_id uuid null`, `food_id uuid null`
  (exactly one of recipe or food), `cook_servings numeric(4,2) null`
  (how many servings will be cooked; defaults to the recipe's servings; drives
  groceries), `eaten_portions numeric(4,2) not null default 1` (what this user
  eats; drives nutrition and logging), `note text null`.
- Index `(user_id, plan_date)`.

`grocery_lists`
- `id`, `user_id`, `week_start date`, `generated_at timestamptz`,
  `include_staples boolean not null default false`; unique `(user_id, week_start)`.

`grocery_list_items`
- `id`, `list_id`, `user_id` (composite FK), `food_id uuid null`,
  `name_en`, `name_fa`, `grams numeric null`, `count numeric null`,
  `grocery_section text`, `have boolean default false`, `bought boolean default false`,
  `is_manual boolean default false`, `position int`.

Plan screen (`/food` → Plan):
- 7 days × 4 slots, week starting on the profile's `week_starts_on`. Mobile shows
  one day at a time with a day switcher; wider screens show the week grid.
- Add to a slot: pick a recipe or a food; set eaten portions (½, 1, 1½, 2) and,
  for recipes, cook servings.
- "Copy last week", "Clear week", drag or move between slots.
- Day totals (kcal, protein) against targets; week average.

Grocery generation (pure function, unit-tested):
1. Take the plan entries for `[week_start, week_start + 6]`.
2. Recipe entries: for each ingredient with a food, add
   `grams × cook_servings / recipe.servings`. Food entries: add
   `serving_grams × eaten_portions` (or grams if set).
3. Sum by food. Drop staples unless `include_staples`. Ingredients without a
   food are listed once in a "Staples to check" group only when staples are on.
4. Display: grams ≥ 1000 as kg with one decimal; foods with `count_unit_grams`
   as a rounded-up count ("6 eggs"); otherwise grams rounded to 50 g.
5. Group by `grocery_section`, sections in the seed's order.
6. Regenerate when the plan changes, merging with the saved list: keep `have`
   and `bought` flags by `food_id`, keep manual items, drop items whose food no
   longer appears unless already bought.

Grocery screen (`/food` → Groceries):
- "I have it" and "Bought" ticks; unticked items form the shopping list.
- Add manual items; toggle staples; share/print view (a clean printable page
  in the user's language, for a family member who shops).
- Works offline: the current week's list is in the offline snapshot and ticks
  are queued like existing offline completions.

Reminders (extend the existing notification system):
- Add to `notification_preferences`: `meal_plan_enabled boolean default false`,
  `meal_plan_dow smallint`, `meal_plan_time time`,
  `grocery_enabled boolean default false`, `grocery_dow smallint`,
  `grocery_time time`.
- Sender (`/api/notifications/send`): categories `meal_plan` ("Plan next week's
  meals" → `/food?tab=plan&week=next`) and `grocery` ("Your grocery list for
  next week is ready" → `/food?tab=groceries&week=next`). Generic, translated
  copy only; no food names. Event key per user and week. Same late-delivery
  window and TTL rules as health/workout reminders. Grocery reminder is skipped
  if next week's plan is empty (send the plan reminder copy instead).
- Settings: two new rows in reminder settings with day and time pickers.

Acceptance:
- [ ] Grocery generation unit tests: scaling by cook servings, staples on/off,
      count display, merge keeps flags and manual items.
- [ ] Planning a week from "copy last week" takes under 30 seconds.
- [ ] Offline: open groceries in airplane mode, tick items, reconnect, ticks sync.
- [ ] Push payloads contain no food or recipe names (test).

### S5 — Food logging and Today totals

Table `food_log_entries`
- `id`, `user_id`, `eaten_on date`, `slot text` (same values as the plan),
  `source text check (source in ('plan','recipe','food','quick'))`,
  `meal_plan_entry_id uuid null`, `recipe_id uuid null`, `food_id uuid null`,
  `portions numeric(4,2) null`, `grams numeric(6,1) null`,
  `label text` (what to show, snapshot of the name in the user's language),
  `kcal int not null`, `protein numeric(5,1)`, `fat numeric(5,1)`,
  `carbs numeric(5,1)`, `note text null`.
- Index `(user_id, eaten_on)`.

Screens:
- Today "Meals" section: today's planned entries by slot, each with
  "Ate as planned" (one tap, logs with `source='plan'`), a portion adjuster
  (½ / 1 / 1½ / 2) and "Ate something else".
- Quick add sheet: tabs Recent (last 20 distinct items), Search (catalog +
  own foods + recipes, serving or grams), Quick calories (kcal and optional
  protein, label).
- Today totals bar: kcal eaten / target and protein eaten / target or limit
  (limit mode uses the amber rule from 4.3). Hidden until a body profile exists;
  shows a "Set up your targets" link instead.
- `/food` → Log: day view with entries by slot, edit/delete, day totals, a
  7-day chart of kcal and protein.

Acceptance:
- [ ] Logging a planned meal is one tap; undo is available for 5 seconds.
- [ ] Editing a recipe afterwards does not change past log entries (snapshot test).
- [ ] Totals match the sum of entries; targets come from section 4 including overrides and accepted adjustments.

### S6 — Structured workouts

Tables:
- `workout_plan_exercises`: `id`, `plan_id`, `user_id` (composite FK to
  `workout_plans`), `position`, `name`, `target_sets smallint`,
  `rep_scheme text` (examples: "3x10", "15/12/10", "3x10 each leg"),
  `rest_seconds smallint null`, `notes text null`.
- `workout_set_logs`: `id`, `session_id`, `exercise_id`, `user_id`,
  `set_number smallint`, `reps smallint`, `weight_kg numeric(5,1) null`,
  `band_level text null`, `rpe numeric(3,1) null`, `completed_at timestamptz`.
- Keep `workout_plans.exercises` text for existing plans. Add a "Convert to
  structured exercises" action that parses one exercise per line
  (`name — sets x reps` patterns) and lets the user fix the result.

Screens:
- Plan editor: exercise rows with name, scheme, rest; reorder.
- Session screen: each exercise with its target scheme; tap a set to log reps
  and weight, prefilled from the last session; rest timer optional.
- Progression hint: when every set in the last session reached the top of the
  scheme, show "Try the next weight step" on that exercise.

Acceptance:
- [ ] Parser handles "3x10", "15/12/10" (pyramid), "3 × 12 each leg".
- [ ] Prefill uses the most recent completed session of the same plan.
- [ ] Existing free-text plans keep working unchanged.

### S7 — Weekly review and adaptive reminders

S7a — notification open tracking:
- Add `opened_at timestamptz null` to `push_deliveries`.
- Service worker `notificationclick` posts `{eventKey, category, endpoint}` to a
  new `/api/notifications/opened` route. Like `/api/offline/sync` (also called
  from the service worker) it authenticates with the session cookie and a
  same-origin check; the endpoint only selects which of the user's own
  subscriptions the delivery belongs to (endpoints are stored unhashed, as the
  existing subscription route does). Rate-limited. The push payload carries the
  event key and category (ids only) so the worker can report the open.

S7b — adaptive reminders:
- For each user and category, look at the last 5 delivered reminders. If none
  was opened, mark the category "quiet": daily categories send every other day,
  and Today shows a small card: "You haven't opened the last 5 X reminders —
  Pause / Change time / Keep". Opening one reminder clears quiet mode.
- A null `opened_at` is weak evidence: the service worker reports opens
  best-effort, so a click while offline is never recorded. Only ever soften
  frequency on it, and only after the full window of 5.
- Never disable a category silently. Health (medication) reminders are exempt
  from frequency reduction; only the card is shown.

S7c — weekly review (`/review`, linked from Today on week start day):
- Weight trend and observed rate (4.1), average daily kcal and protein logged,
  days logged, workouts completed, routines completed, average steps if a steps
  routine exists, and the adjustment suggestion (4.5) with Accept / Dismiss.

Acceptance:
- [ ] Quiet mode turns on after 5 unopened deliveries and off after one open (tests with fixtures).
- [ ] Review suggestion follows the table in 4.5 for fixture weigh-in series.

---

## 6. i18n, layout and accessibility

- All copy in `src/lib/i18n/en.ts` and `fa.ts`; parity test must pass.
- Food and recipe names: show the user's language, fall back to the other.
- Numbers: follow existing formatting helpers; units "kcal", "g", "kg", "cm"
  translated ("کالری", "گرم", "کیلوگرم", "سانتی‌متر").
- Charts and grids mirror in RTL; day order follows `week_starts_on`.
- Every control reachable by keyboard; sheets trap focus (existing `Sheet`).

## 7. Testing checklist per slice

- Unit tests for every pure function in `src/lib/nutrition/` and grocery generation.
- RLS SQL test per table family in `supabase/tests/`.
- Contract test that push payloads for new categories contain only generic copy.
- `npm run verify`; manual check in en and fa at 390 px and desktop; offline
  check for groceries.

## 8. Ready-to-use session prompts

Start each in plan mode.

- S0: "Read docs/nutrition-roadmap.md section S0 and plan the Today refactor. Keep behaviour identical."
- S1: "Implement docs/nutrition-roadmap.md S1: schema for foods, recipes, recipe_ingredients with RLS, the seed generator script and the generated seed migration from supabase/seed/*.json. Use the db-change skill."
- S2: "Implement S2 from docs/nutrition-roadmap.md: body tables, src/lib/nutrition calculations with tests, /body screen and the Today weigh-in card."
- S3–S7: "Implement S<n> from docs/nutrition-roadmap.md." Then follow its acceptance list.
