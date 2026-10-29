create or replace function public.assign_program_to_athletes(
  p_program_id uuid,
  p_athlete_ids uuid[],
  p_start_date date,
  p_sync_mode text
)
returns setof public.program_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_coach uuid := (select auth.uid());
  target_athlete_id uuid;
  snapshot jsonb;
  assignment public.program_assignments%rowtype;
begin
  if current_coach is null or not public.current_user_has_role('coach') then
    raise exception using errcode = '42501', message = 'coach_only';
  end if;
  if p_sync_mode not in ('live', 'snapshot') or p_start_date is null
    or coalesce(array_length(p_athlete_ids, 1), 0) = 0 then
    raise exception using errcode = '22023', message = 'assignment_details_invalid';
  end if;
  if (select count(distinct ids.athlete_id)::integer from unnest(p_athlete_ids) ids(athlete_id)) <> array_length(p_athlete_ids, 1) then
    raise exception using errcode = '22023', message = 'duplicate_athlete_ids';
  end if;
  if not exists (select 1 from public.programs p where p.id = p_program_id and p.coach_id = current_coach and p.archived_at is null) then
    raise exception using errcode = '42501', message = 'program_not_owned';
  end if;
  if exists (
    select 1 from unnest(p_athlete_ids) ids(athlete_id)
    where not public.is_active_coach_athlete(current_coach, ids.athlete_id)
  ) then
    raise exception using errcode = '42501', message = 'athlete_not_linked';
  end if;

  perform 1 from public.profiles p
  where p.id = any(p_athlete_ids) order by p.id for update;
  if p_sync_mode = 'snapshot' then snapshot := public.snapshot_coach_program(p_program_id); end if;

  foreach target_athlete_id in array p_athlete_ids loop
    update public.program_assignments a set status = 'ended'
    where a.athlete_id = target_athlete_id and a.status = 'active';

    insert into public.program_assignments (program_id, coach_id, athlete_id, start_date, sync_mode, status, program_snapshot)
    values (p_program_id, current_coach, target_athlete_id, p_start_date, p_sync_mode, 'active', snapshot)
    returning * into assignment;
    return next assignment;
  end loop;
end;
$$;
