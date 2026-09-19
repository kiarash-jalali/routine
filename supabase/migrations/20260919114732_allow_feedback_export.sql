-- Allow signed-in users to include their own feedback in account data exports.
grant select on table public.feedback to authenticated;

drop policy if exists feedback_select_own on public.feedback;

create policy feedback_select_own
on public.feedback
for select
to authenticated
using ((select auth.uid()) = user_id);
