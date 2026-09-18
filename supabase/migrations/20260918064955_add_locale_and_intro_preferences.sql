-- Additive preferences. Existing completed onboarding remains completed.
alter table public.profiles
  add column locale text not null default 'en' check (locale in ('en', 'fa')),
  add column intro_seen boolean not null default false;
update public.profiles set intro_seen = true where onboarding_completed;
-- Language metadata is a display preference only, never an authorization claim.
create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, onboarding_completed, locale)
  values (new.id, false, case when new.raw_user_meta_data->>'locale' = 'fa' then 'fa' else 'en' end)
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.create_profile_for_new_user() from public, anon, authenticated;
-- Existing owner SELECT/UPDATE policies also protect these new columns.
