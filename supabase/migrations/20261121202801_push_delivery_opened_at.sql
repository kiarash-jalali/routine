-- Nutrition roadmap S7a: record when a delivered reminder is opened, so S7b can
-- reduce frequency of reminders that are consistently ignored.
-- push_deliveries stays service-role only (no browser grants); the
-- /api/notifications/opened route writes it after authenticating the user.
alter table public.push_deliveries
  add column if not exists opened_at timestamptz;

-- S7b reads the last deliveries per subscription and category.
create index if not exists push_deliveries_subscription_category_idx
  on public.push_deliveries(subscription_id, category, delivered_at desc);
