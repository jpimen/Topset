-- Rollback: drop the exercise_name check and column from public.program_exercises.
alter table public.program_exercises
  add column exercise_name text,
  add constraint program_exercises_exercise_name_length_check
    check (exercise_name is null or length(btrim(exercise_name)) between 1 and 120);

drop policy "coaches manage own program exercises" on public.program_exercises;
create policy "coaches manage own program exercises" on public.program_exercises
  for all to authenticated using (
    public.current_user_has_role('coach')
    and exists (
      select 1 from public.days d join public.weeks w on w.id = d.week_id
      where d.id = day_id and public.owns_program(w.program_id, (select auth.uid()))
    )
  ) with check (
    public.current_user_has_role('coach')
    and exists (
      select 1 from public.days d join public.weeks w on w.id = d.week_id
      where d.id = day_id and public.owns_program(w.program_id, (select auth.uid()))
    )
    and (
      public.program_exercises.exercise_id is null
      or exists (
        select 1 from public.exercises e
        where e.id = public.program_exercises.exercise_id
          and (e.owner_id is null or e.owner_id = (select auth.uid()))
      )
    )
  );

-- Preserve the existing transactional document save while persisting names that
-- belong only to one program and have no shared exercises-table record.
do $$
declare
  function_definition text;
  original_definition text;
begin
  select pg_get_functiondef('public.save_coach_program_document(uuid, timestamptz, jsonb)'::regprocedure)
    into function_definition;
  original_definition := function_definition;
  function_definition := replace(function_definition,
    'id, day_id, exercise_id, position, set_type, sets, reps, reps_min, reps_max,',
    'id, day_id, exercise_id, exercise_name, position, set_type, sets, reps, reps_min, reps_max,');
  function_definition := replace(function_definition,
    'row_id, day_id, (row_json->>''exercise_id'')::uuid,',
    'row_id, day_id, (row_json->>''exercise_id'')::uuid, nullif(btrim(row_json->>''exercise_name''), ''''),');
  function_definition := replace(function_definition,
    'day_id = excluded.day_id, exercise_id = excluded.exercise_id, position = excluded.position,',
    'day_id = excluded.day_id, exercise_id = excluded.exercise_id, exercise_name = excluded.exercise_name, position = excluded.position,');
  if function_definition = original_definition
    or position('exercise_name = excluded.exercise_name' in function_definition) = 0 then
    raise exception 'Could not update save_coach_program_document for program-scoped exercise names';
  end if;
  execute function_definition;
end;
$$;

create or replace function public.snapshot_coach_program(p_program_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'program', jsonb_build_object(
      'id', p.id, 'name', p.name, 'description', p.description,
      'unit', p.unit, 'updated_at', p.updated_at
    ),
    'weeks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', w.id, 'week_number', w.week_number, 'name', w.name, 'notes', w.notes,
        'days', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', d.id, 'day_number', d.day_number, 'name', d.name, 'notes', d.notes,
            'exercises', coalesce((
              select jsonb_agg(to_jsonb(pe) || jsonb_build_object(
                'exercise', case when e.id is null then jsonb_build_object(
                  'id', pe.id, 'name', pe.exercise_name, 'category', 'accessory',
                  'movement', 'other', 'is_competition_lift', false
                ) else to_jsonb(e) end
              ) order by pe.position)
              from public.program_exercises pe
              left join public.exercises e on e.id = pe.exercise_id
              where pe.day_id = d.id
                and (e.id is not null or nullif(btrim(pe.exercise_name), '') is not null)
            ), '[]'::jsonb)
          ) order by d.day_number)
          from public.days d where d.week_id = w.id
        ), '[]'::jsonb)
      ) order by w.week_number)
      from public.weeks w where w.program_id = p.id
    ), '[]'::jsonb)
  )
  from public.programs p where p.id = p_program_id;
$$;
