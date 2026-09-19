-- Phase 3 maintenance: remove the abandoned reminder-introduction state.
-- Notification permission remains explicitly user-initiated from Settings.

drop function if exists public.claim_reminder_introduction();

alter table public.profiles
  drop column if exists reminder_intro_seen;
