-- Rollback: drop policy "linked coaches read workout check-ins" on public.athlete_workout_checkins.
create policy "linked coaches read workout check-ins" on public.athlete_workout_checkins
  for select to authenticated using (
    public.current_user_has_role('coach')
    and exists (
      select 1
      from public.program_assignments a
      where a.id = athlete_workout_checkins.assignment_id
        and a.athlete_id = athlete_workout_checkins.athlete_id
        and a.coach_id = (select auth.uid())
        and a.status = 'active'
        and a.start_date <= current_date
        and public.is_active_coach_athlete(a.coach_id, a.athlete_id)
        and case
          when a.sync_mode = 'snapshot' then exists (
            select 1
            from jsonb_array_elements(coalesce(a.program_snapshot -> 'weeks', '[]'::jsonb)) w
            cross join lateral jsonb_array_elements(coalesce(w -> 'days', '[]'::jsonb)) d
            where d ->> 'id' = athlete_workout_checkins.day_id::text
          )
          else exists (
            select 1
            from public.days d
            join public.weeks w on w.id = d.week_id
            where d.id = athlete_workout_checkins.day_id
              and w.program_id = a.program_id
          )
        end
    )
  );

comment on table public.athlete_workout_checkins is 'Private athlete check-in values readable by the athlete and their currently linked coach for an active assigned day.';
