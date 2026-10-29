-- Rollback: drop public.athlete_workout_checkins; this permanently removes check-ins associated with training days.
-- Date-based athlete_daily_checkins rows are retained and are not assigned to a workout day automatically.
create table public.athlete_workout_checkins (
  assignment_id uuid not null,
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  day_id uuid not null,
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
  primary key (assignment_id, day_id),
  constraint athlete_workout_checkins_assignment_athlete_fkey foreign key (assignment_id, athlete_id)
    references public.program_assignments (id, athlete_id) on delete cascade,
  constraint athlete_workout_checkins_nonempty check (
    bodyweight is not null or sleep_quality is not null or sleep_hours is not null
    or protein_grams is not null or calories_kcal is not null or carbs_grams is not null
    or fatigue_level is not null
  )
);

create trigger athlete_workout_checkins_set_updated_at before update on public.athlete_workout_checkins
  for each row execute function public.set_updated_at();
alter table public.athlete_workout_checkins enable row level security;
revoke all on public.athlete_workout_checkins from public, anon, authenticated;
grant select, insert, update on public.athlete_workout_checkins to authenticated;

create policy "athletes read own workout check-ins" on public.athlete_workout_checkins
  for select to authenticated using (
    public.current_user_has_role('athlete')
    and athlete_id = (select auth.uid())
    and public.athlete_can_access_workout_day(assignment_id, day_id)
  );
create policy "athletes insert own workout check-ins" on public.athlete_workout_checkins
  for insert to authenticated with check (
    public.current_user_has_role('athlete')
    and athlete_id = (select auth.uid())
    and public.athlete_can_access_workout_day(assignment_id, day_id)
  );
create policy "athletes update own workout check-ins" on public.athlete_workout_checkins
  for update to authenticated using (
    public.current_user_has_role('athlete')
    and athlete_id = (select auth.uid())
    and public.athlete_can_access_workout_day(assignment_id, day_id)
  ) with check (
    public.current_user_has_role('athlete')
    and athlete_id = (select auth.uid())
    and public.athlete_can_access_workout_day(assignment_id, day_id)
  );

comment on table public.athlete_workout_checkins is 'Private athlete check-in values attached to one day in an active assigned program.';
