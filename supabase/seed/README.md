# Seed data

Source data for the nutrition features (see `docs/nutrition-roadmap.md`, slice S1).
These files are not applied automatically: `scripts/generate-food-seed.mjs` (to be written in S1)
turns them into an idempotent migration.

| File | Contents |
| --- | --- |
| `food-catalog.json` | 53 ingredients (`ing-…`) and 300 dishes: 150 Iranian (`ir-…`), 150 global (`gl-…`). Bilingual names, serving size, per-100 g and per-serving kcal, protein, fat, carbs, fiber, and tags (red_meat, organ_meat, fish, seafood, legume, high_sugar, fried, high_salt). |
| `starter-recipes.json` | 40 Persian starter recipes. Ingredients reference catalog slugs; `food_slug: null` rows are spices/staples. `steps_en`/`tip_en` are null until translated in S1. |

Nutrition values are approximate averages for logging and planning, not lab measurements.
Dish kcal is derived as 4·protein + 4·carbs + 9·fat per 100 g.
