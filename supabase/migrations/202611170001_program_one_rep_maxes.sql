-- Rollback: restore save_coach_program_with_blocks from 202611140002, then drop these columns.
alter table public.programs
  add column squat_max numeric(9, 2) check (squat_max is null or squat_max between 0.01 and 2000),
  add column bench_max numeric(9, 2) check (bench_max is null or bench_max between 0.01 and 2000),
  add column deadlift_max numeric(9, 2) check (deadlift_max is null or deadlift_max between 0.01 and 2000);

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
  if p_document#>'{program,squat_max}' is not null
     and p_document#>'{program,bench_max}' is not null
     and p_document#>'{program,deadlift_max}' is not null then
    update public.programs set
      squat_max = nullif(p_document#>>'{program,squat_max}', 'null')::numeric,
      bench_max = nullif(p_document#>>'{program,bench_max}', 'null')::numeric,
      deadlift_max = nullif(p_document#>>'{program,deadlift_max}', 'null')::numeric
    where id = p_program_id;
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
