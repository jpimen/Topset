-- The document save RPC re-numbers weeks and days before it removes deleted
-- entries. Defer these uniqueness checks until the RPC transaction completes
-- so replacing an occupied number does not fail halfway through a valid save.
-- Rollback: alter table public.weeks drop constraint weeks_program_id_week_number_key;
-- alter table public.weeks add constraint weeks_program_id_week_number_key unique (program_id, week_number);
-- alter table public.days drop constraint days_week_id_day_number_key;
-- alter table public.days add constraint days_week_id_day_number_key unique (week_id, day_number);

alter table public.weeks
  drop constraint weeks_program_id_week_number_key,
  add constraint weeks_program_id_week_number_key
    unique (program_id, week_number) deferrable initially deferred;

alter table public.days
  drop constraint days_week_id_day_number_key,
  add constraint days_week_id_day_number_key
    unique (week_id, day_number) deferrable initially deferred;
