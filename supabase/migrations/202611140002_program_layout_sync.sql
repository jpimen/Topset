-- Rollback: restore save_coach_program_with_blocks from 202611030004 and snapshot_coach_program from 202611100001, then drop this constraint and column.
alter table public.programs
  add column layout jsonb not null default '{"columns":{"exercise":180,"set_type":95,"sets":60,"reps":75,"rpe":75,"load":175,"coach_notes":150,"athlete_load":100,"athlete_rpe":100,"athlete_notes":120,"athlete_total":100},"rowHeight":48}'::jsonb,
  add constraint programs_layout_shape_check check (
    jsonb_typeof(layout) = 'object'
    and jsonb_typeof(layout->'columns') is not distinct from 'object'
    and jsonb_typeof(layout->'rowHeight') is not distinct from 'number'
    and (layout->>'rowHeight')::numeric between 40 and 88
    and mod((layout->>'rowHeight')::numeric, 1) = 0
    and jsonb_typeof(layout#>'{columns,exercise}') is not distinct from 'number' and (layout#>>'{columns,exercise}')::numeric between 140 and 360
    and jsonb_typeof(layout#>'{columns,set_type}') is not distinct from 'number' and (layout#>>'{columns,set_type}')::numeric between 70 and 220
    and jsonb_typeof(layout#>'{columns,sets}') is not distinct from 'number' and (layout#>>'{columns,sets}')::numeric between 50 and 140
    and jsonb_typeof(layout#>'{columns,reps}') is not distinct from 'number' and (layout#>>'{columns,reps}')::numeric between 55 and 160
    and jsonb_typeof(layout#>'{columns,rpe}') is not distinct from 'number' and (layout#>>'{columns,rpe}')::numeric between 55 and 160
    and jsonb_typeof(layout#>'{columns,load}') is not distinct from 'number' and (layout#>>'{columns,load}')::numeric between 100 and 340
    and jsonb_typeof(layout#>'{columns,coach_notes}') is not distinct from 'number' and (layout#>>'{columns,coach_notes}')::numeric between 100 and 380
    and jsonb_typeof(layout#>'{columns,athlete_load}') is not distinct from 'number' and (layout#>>'{columns,athlete_load}')::numeric between 85 and 300
    and jsonb_typeof(layout#>'{columns,athlete_rpe}') is not distinct from 'number' and (layout#>>'{columns,athlete_rpe}')::numeric between 75 and 260
    and jsonb_typeof(layout#>'{columns,athlete_notes}') is not distinct from 'number' and (layout#>>'{columns,athlete_notes}')::numeric between 90 and 380
    and jsonb_typeof(layout#>'{columns,athlete_total}') is not distinct from 'number' and (layout#>>'{columns,athlete_total}')::numeric between 85 and 300
  );

create or replace function public.save_coach_program_with_blocks(
  p_program_id uuid,
  p_expected_updated_at timestamptz,
  p_document jsonb
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  block_json jsonb;
  week_json jsonb;
  target_block_id uuid;
  week_id uuid;
  saved_at timestamptz;
  keep_block_ids uuid[] := array[]::uuid[];
begin
  if not public.current_user_has_role('coach') then
    raise exception using errcode = '42501', message = 'Coach access required';
  end if;
  if not exists (
    select 1 from public.programs p
    where p.id = p_program_id and p.coach_id = (select auth.uid())
  ) then
    raise exception using errcode = '42501', message = 'Program not found';
  end if;
  if p_document ? 'blocks' and jsonb_typeof(p_document->'blocks') is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Program blocks must be an array';
  end if;
  if p_document ? 'layout' and (
    jsonb_typeof(p_document->'layout') is distinct from 'object'
    or jsonb_typeof(p_document#>'{layout,columns}') is distinct from 'object'
  ) then
    raise exception using errcode = '22023', message = 'Program layout is invalid';
  end if;

  saved_at := public.save_coach_program_document(
    p_program_id, p_expected_updated_at, p_document - 'blocks'
  );

  if p_document ? 'layout' then
    update public.programs set layout = p_document->'layout' where id = p_program_id;
  end if;

  if p_document ? 'blocks' then
    for block_json in select value from jsonb_array_elements(p_document->'blocks') loop
      target_block_id := nullif(block_json->>'id', '')::uuid;
      if target_block_id is null then
        raise exception using errcode = '22023', message = 'Program block id is required';
      end if;
      if exists (select 1 from public.blocks where id = target_block_id and program_id <> p_program_id) then
        raise exception using errcode = '22023', message = 'Block does not belong to this program';
      end if;
      keep_block_ids := array_append(keep_block_ids, target_block_id);
      insert into public.blocks (id, program_id, name, position, notes)
      values (
        target_block_id, p_program_id, coalesce(nullif(btrim(block_json->>'name'), ''), 'Training Block'),
        coalesce((block_json->>'position')::integer, 0), block_json->>'notes'
      )
      on conflict (id) do update set
        name = excluded.name, position = excluded.position, notes = excluded.notes;
    end loop;

    for week_json in select value from jsonb_array_elements(coalesce(p_document->'weeks', '[]'::jsonb)) loop
      week_id := nullif(week_json->>'id', '')::uuid;
      target_block_id := nullif(week_json->>'block_id', '')::uuid;
      if target_block_id is not null and not (target_block_id = any(keep_block_ids)) then
        raise exception using errcode = '22023', message = 'Week refers to a block missing from this program document';
      end if;
      update public.weeks
      set block_id = target_block_id
      where id = week_id and program_id = p_program_id;
    end loop;

    delete from public.blocks
    where program_id = p_program_id and not (id = any(keep_block_ids));
  end if;

  select updated_at into saved_at from public.programs where id = p_program_id;
  return saved_at;
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
    'layout', p.layout,
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
