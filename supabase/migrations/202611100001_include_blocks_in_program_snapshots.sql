-- Rollback: restore public.snapshot_coach_program from
-- 202611090002_program_scoped_exercise_names.sql.
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
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'name', b.name, 'notes', b.notes
      ) order by b.position)
      from public.blocks b where b.program_id = p.id
    ), '[]'::jsonb),
    'weeks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', w.id, 'block_id', w.block_id, 'week_number', w.week_number, 'name', w.name, 'notes', w.notes,
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
