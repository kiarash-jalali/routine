-- Private-alpha feedback
--
-- Testers can submit feedback from Settings. Feedback is intentionally
-- write-only from the browser: users can create their own entries, while
-- reviewing/exporting feedback remains an admin operation in Supabase.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('bug', 'friction', 'idea', 'other')),
  message text not null check (char_length(trim(message)) between 3 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_at_idx
  on public.feedback (created_at desc);

alter table public.feedback enable row level security;

revoke all on table public.feedback from anon;
revoke all on table public.feedback from authenticated;
grant insert on table public.feedback to authenticated;

drop policy if exists feedback_insert_own on public.feedback;
create policy feedback_insert_own
  on public.feedback
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);
