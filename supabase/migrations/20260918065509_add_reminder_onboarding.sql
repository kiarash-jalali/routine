alter table public.profiles add column reminder_intro_seen boolean not null default false;
-- Existing routine users already have access to Settings; never interrupt them retroactively.
update public.profiles p set reminder_intro_seen = true
where exists (select 1 from public.routines r where r.user_id = p.user_id);
create function public.claim_reminder_introduction() returns boolean
language plpgsql security invoker set search_path = '' as $$
declare claimed boolean;
begin
  update public.profiles set reminder_intro_seen = true
  where user_id = (select auth.uid()) and not reminder_intro_seen
  returning true into claimed;
  return coalesce(claimed, false);
end;
$$;
revoke all on function public.claim_reminder_introduction() from public, anon;
grant execute on function public.claim_reminder_introduction() to authenticated;
