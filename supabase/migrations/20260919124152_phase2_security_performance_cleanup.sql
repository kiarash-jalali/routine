-- Phase 2 audit cleanup: remove an unused API surface and cover the
-- medication reminder composite foreign key used for referential checks.

create index if not exists medication_reminders_medication_user_idx
  on public.medication_reminders (medication_id, user_id);

drop extension if exists pg_graphql;
