---
name: db-change
description: Workflow for any rootine database change — new table, column, index, policy, function/RPC or cron job in Supabase. Use whenever a change needs SQL against the schema.
---

Rootine's database is the live production Supabase project (`dsjydycnbntkohquhrqo`).
Treat every schema change as a production change.

## Before writing SQL

1. Read `supabase/MIGRATIONS.md` (history is partly out of sync with filenames — do not
   "fix" old files) and the existing migrations that touch the same tables.
2. Inspect the current live schema with read-only queries or `list_tables` rather than
   trusting memory.
3. Write the plan in plan mode: tables/columns, RLS policies, grants, indexes, and how
   existing rows are handled. Get the user's approval.

## Writing the migration

- One new file: `supabase/migrations/<YYYYMMDDHHMMSS>_<snake_name>.sql`. Never edit old ones.
- Additive and safe to re-run where possible (`if not exists`, `create or replace`).
- New tables: `alter table … enable row level security;` before any grant; owner policies
  for SELECT/INSERT/UPDATE/DELETE using `(select auth.uid()) = user_id`; UPDATE has both
  USING and WITH CHECK; no grants to `anon`.
- Child tables reference the parent with a composite `(parent_id, user_id)` foreign key so
  one user can't attach rows to another user's parent.
- Functions: `set search_path = ''`, fully qualified names, `security invoker` unless there
  is a written reason (put it in a SQL comment). Revoke execute from `public, anon`.
- Index every foreign key and the columns used in the app's filters.
- Health-related tables: no data in push payloads or logs; document that in a comment.

## Applying

1. Show the user the final SQL and **wait for explicit approval**.
2. Apply it with the Supabase MCP `apply_migration` tool, using the same name as the file.
   Then make sure the file's timestamp matches the version Supabase recorded
   (`list_migrations`); rename the new file if needed and add a row to `MIGRATIONS.md`.
3. Regenerate types into `src/types/database.ts` (Supabase MCP `generate_typescript_types`).
4. Run security and performance advisors. Fix new warnings or explain why they're accepted.
5. If RLS changed, add or extend a rolled-back test in `supabase/tests/` that checks owner
   access, cross-user denial and anon denial with synthetic users.
6. `npm run verify`.
