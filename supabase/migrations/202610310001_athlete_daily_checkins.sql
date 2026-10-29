-- Rollback: drop public.athlete_daily_checkins; this permanently removes athlete check-in history.
create table public.athlete_daily_checkins (
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  -- A local calendar date can be one day ahead of the database's UTC date.
  checkin_date date not null check (checkin_date <= current_date + 1),
  bodyweight numeric(7, 2) check (bodyweight is null or bodyweight between 0.1 and 500),
  bodyweight_unit text not null default 'kg' check (bodyweight_unit in ('kg', 'lb')),
  sleep_quality smallint check (sleep_quality is null or sleep_quality between 1 and 5),
  sleep_hours numeric(4, 1) check (sleep_hours is null or sleep_hours between 0 and 16 and sleep_hours * 2 = trunc(sleep_hours * 2)),
  protein_grams numeric(7, 1) check (protein_grams is null or protein_grams between 0 and 1000),
  calories_kcal integer check (calories_kcal is null or calories_kcal between 0 and 20000),
  carbs_grams numeric(7, 1) check (carbs_grams is null or carbs_grams between 0 and 2000),
  fatigue_level smallint check (fatigue_level is null or fatigue_level between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (athlete_id, checkin_date),
  constraint athlete_daily_checkins_nonempty check (
    bodyweight is not null or sleep_quality is not null or sleep_hours is not null
    or protein_grams is not null or calories_kcal is not null or carbs_grams is not null
    or fatigue_level is not null
  )
);

create trigger athlete_daily_checkins_set_updated_at before update on public.athlete_daily_checkins
  for each row execute function public.set_updated_at();
alter table public.athlete_daily_checkins enable row level security;
revoke all on public.athlete_daily_checkins from public, anon, authenticated;
grant select, insert, update on public.athlete_daily_checkins to authenticated;

create policy "athletes read own daily check-ins" on public.athlete_daily_checkins
  for select to authenticated using (
    public.current_user_has_role('athlete') and athlete_id = (select auth.uid())
  );
create policy "athletes insert own daily check-ins" on public.athlete_daily_checkins
  for insert to authenticated with check (
    public.current_user_has_role('athlete') and athlete_id = (select auth.uid())
  );
create policy "athletes update own daily check-ins" on public.athlete_daily_checkins
  for update to authenticated using (
    public.current_user_has_role('athlete') and athlete_id = (select auth.uid())
  ) with check (
    public.current_user_has_role('athlete') and athlete_id = (select auth.uid())
  );

comment on table public.athlete_daily_checkins is 'Private per-athlete daily bodyweight, sleep, nutrition, and fatigue self-report. Coaches have no access.';
