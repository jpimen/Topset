create type public.exercise_category as enum ('main', 'variation', 'accessory');
create type public.exercise_movement as enum ('squat', 'bench', 'deadlift', 'other');
create type public.program_set_type as enum ('top', 'backoff', 'working', 'warmup', 'amrap');
create type public.program_load_mode as enum ('absolute', 'percent', 'rpe', 'none');

alter table public.programs
  add column unit text not null default 'kg' check (unit in ('kg', 'lb')),
  add column archived_at timestamptz;

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  position integer not null default 0 check (position >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index blocks_program_position_idx on public.blocks (program_id, position);

create table public.weeks (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  block_id uuid references public.blocks (id) on delete cascade,
  week_number integer not null check (week_number > 0),
  name text not null default '',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, week_number)
);
create index weeks_program_block_idx on public.weeks (program_id, block_id);

create table public.days (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.weeks (id) on delete cascade,
  day_number integer not null check (day_number > 0),
  name text not null default '',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (week_id, day_number)
);
create index days_week_number_idx on public.days (week_id, day_number);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  category public.exercise_category not null,
  movement public.exercise_movement not null default 'other',
  muscle_group text,
  is_competition_lift boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index exercises_builtin_name_idx on public.exercises (lower(name)) where owner_id is null;
create unique index exercises_owner_name_idx on public.exercises (owner_id, lower(name)) where owner_id is not null;
create index exercises_owner_category_name_idx on public.exercises (owner_id, category, lower(name));

create table public.program_exercises (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.days (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  position integer not null default 0 check (position >= 0),
  set_type public.program_set_type default 'working',
  sets integer default 3 check (sets is null or (sets > 0 and sets <= 100)),
  reps text not null default '5' check (char_length(reps) between 0 and 24),
  reps_min integer check (reps_min is null or reps_min > 0),
  reps_max integer check (reps_max is null or reps_max > 0),
  rpe numeric(3, 1) check (rpe is null or (rpe between 5 and 10 and rpe * 2 = trunc(rpe * 2))),
  load_mode public.program_load_mode not null default 'none',
  load_value numeric(9, 2) check (load_value is null or load_value >= 0),
  load_min numeric(9, 2) check (load_min is null or load_min >= 0),
  load_max numeric(9, 2) check (load_max is null or load_max >= 0),
  percent_of text check (percent_of is null or percent_of in ('e1rm', 'tm')),
  notes_coach text,
  superset_group text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reps_min is null or reps_max is null or reps_min <= reps_max),
  check (load_min is null or load_max is null or load_min <= load_max)
);
create index program_exercises_day_position_idx on public.program_exercises (day_id, position);
create index program_exercises_exercise_idx on public.program_exercises (exercise_id);

create table public.athlete_maxes (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  lift public.exercise_movement not null check (lift in ('squat', 'bench', 'deadlift')),
  e1rm numeric(9, 2) not null check (e1rm > 0),
  tested_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index athlete_maxes_athlete_lift_date_idx on public.athlete_maxes (athlete_id, lift, tested_on desc);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger programs_set_updated_at before update on public.programs
  for each row execute function public.set_updated_at();
create trigger blocks_set_updated_at before update on public.blocks
  for each row execute function public.set_updated_at();
create trigger weeks_set_updated_at before update on public.weeks
  for each row execute function public.set_updated_at();
create trigger days_set_updated_at before update on public.days
  for each row execute function public.set_updated_at();
create trigger exercises_set_updated_at before update on public.exercises
  for each row execute function public.set_updated_at();
create trigger program_exercises_set_updated_at before update on public.program_exercises
  for each row execute function public.set_updated_at();
create trigger athlete_maxes_set_updated_at before update on public.athlete_maxes
  for each row execute function public.set_updated_at();

create function public.touch_program_for_builder_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_program_id uuid;
begin
  if tg_table_name = 'blocks' then
    target_program_id := coalesce(new.program_id, old.program_id);
  elsif tg_table_name = 'weeks' then
    target_program_id := coalesce(new.program_id, old.program_id);
  elsif tg_table_name = 'days' then
    select w.program_id into target_program_id
      from public.weeks w where w.id = coalesce(new.week_id, old.week_id);
  elsif tg_table_name = 'program_exercises' then
    select w.program_id into target_program_id
      from public.days d join public.weeks w on w.id = d.week_id
      where d.id = coalesce(new.day_id, old.day_id);
  end if;
  update public.programs set updated_at = clock_timestamp() where id = target_program_id;
  return coalesce(new, old);
end;
$$;

create trigger blocks_touch_program after insert or update or delete on public.blocks
  for each row execute function public.touch_program_for_builder_change();
create trigger weeks_touch_program after insert or update or delete on public.weeks
  for each row execute function public.touch_program_for_builder_change();
create trigger days_touch_program after insert or update or delete on public.days
  for each row execute function public.touch_program_for_builder_change();
create trigger program_exercises_touch_program after insert or update or delete on public.program_exercises
  for each row execute function public.touch_program_for_builder_change();

insert into public.exercises (name, category, movement, muscle_group, is_competition_lift) values
  ('Comp Squat', 'main', 'squat', 'Quadriceps', true),
  ('Comp Bench', 'main', 'bench', 'Chest', true),
  ('Comp Deadlift', 'main', 'deadlift', 'Posterior chain', true),
  ('Pause Squat', 'variation', 'squat', 'Quadriceps', false),
  ('Tempo Squat', 'variation', 'squat', 'Quadriceps', false),
  ('Front Squat', 'variation', 'squat', 'Quadriceps', false),
  ('Spoto Press', 'variation', 'bench', 'Chest', false),
  ('Close Grip Bench', 'variation', 'bench', 'Triceps', false),
  ('Tempo Bench', 'variation', 'bench', 'Chest', false),
  ('Deficit Deadlift', 'variation', 'deadlift', 'Posterior chain', false),
  ('Pause Deadlift', 'variation', 'deadlift', 'Posterior chain', false),
  ('Romanian Deadlift', 'variation', 'deadlift', 'Hamstrings', false),
  ('Tricep Pushdown', 'accessory', 'other', 'Triceps', false),
  ('Single Arm Overhead Extension', 'accessory', 'other', 'Triceps', false),
  ('Reverse Fly', 'accessory', 'other', 'Shoulders', false),
  ('Plank', 'accessory', 'other', 'Core', false),
  ('Glute Bridge Machine', 'accessory', 'other', 'Glutes', false),
  ('Leg Curl', 'accessory', 'other', 'Hamstrings', false),
  ('Back Extension', 'accessory', 'other', 'Posterior chain', false)
on conflict do nothing;

alter table public.programs enable row level security;
alter table public.blocks enable row level security;
alter table public.weeks enable row level security;
alter table public.days enable row level security;
alter table public.exercises enable row level security;
alter table public.program_exercises enable row level security;
alter table public.athlete_maxes enable row level security;

-- M4 introduces assignment-backed athlete program access. Until then the coach-owned
-- program document is private to its coach, including the parent program row.
drop policy "athletes read assigned programs" on public.programs;

create policy "coaches manage own blocks" on public.blocks
  for all to authenticated
  using (public.current_user_has_role('coach') and public.owns_program(program_id, (select auth.uid())))
  with check (public.current_user_has_role('coach') and public.owns_program(program_id, (select auth.uid())));
create policy "coaches manage own weeks" on public.weeks
  for all to authenticated
  using (public.current_user_has_role('coach') and public.owns_program(program_id, (select auth.uid())))
  with check (public.current_user_has_role('coach') and public.owns_program(program_id, (select auth.uid())));
create policy "coaches manage own days" on public.days
  for all to authenticated
  using (
    public.current_user_has_role('coach')
    and exists (select 1 from public.weeks w where w.id = week_id and public.owns_program(w.program_id, (select auth.uid())))
  )
  with check (
    public.current_user_has_role('coach')
    and exists (select 1 from public.weeks w where w.id = week_id and public.owns_program(w.program_id, (select auth.uid())))
  );
create policy "coaches read builtin and manage own exercises" on public.exercises
  for select to authenticated using (
    public.current_user_has_role('coach') and (owner_id is null or owner_id = (select auth.uid()))
  );
create policy "coaches create own exercises" on public.exercises
  for insert to authenticated with check (
    public.current_user_has_role('coach') and owner_id = (select auth.uid())
  );
create policy "coaches update own exercises" on public.exercises
  for update to authenticated using (
    public.current_user_has_role('coach') and owner_id = (select auth.uid())
  ) with check (
    public.current_user_has_role('coach') and owner_id = (select auth.uid())
  );
create policy "coaches delete own exercises" on public.exercises
  for delete to authenticated using (
    public.current_user_has_role('coach') and owner_id = (select auth.uid())
  );
create policy "coaches manage own program exercises" on public.program_exercises
  for all to authenticated using (
    public.current_user_has_role('coach')
    and exists (
      select 1 from public.days d join public.weeks w on w.id = d.week_id
      where d.id = day_id and public.owns_program(w.program_id, (select auth.uid()))
    )
    and exists (select 1 from public.exercises e where e.id = exercise_id and (e.owner_id is null or e.owner_id = (select auth.uid())))
  ) with check (
    public.current_user_has_role('coach')
    and exists (
      select 1 from public.days d join public.weeks w on w.id = d.week_id
      where d.id = day_id and public.owns_program(w.program_id, (select auth.uid()))
    )
    and exists (select 1 from public.exercises e where e.id = exercise_id and (e.owner_id is null or e.owner_id = (select auth.uid())))
  );
create policy "coaches read active linked athlete maxes" on public.athlete_maxes
  for select to authenticated using (
    public.current_user_has_role('coach')
    and public.is_active_coach_athlete((select auth.uid()), athlete_id)
  );

revoke all on public.programs, public.blocks, public.weeks, public.days, public.exercises,
  public.program_exercises, public.athlete_maxes from public, anon;
grant select, insert, update, delete on public.programs to authenticated;
grant select, insert, update, delete on public.blocks, public.weeks, public.days,
  public.program_exercises to authenticated;
grant select, insert, update, delete on public.exercises to authenticated;
grant select on public.athlete_maxes to authenticated;

create function public.save_coach_program_document(
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
  current_program public.programs%rowtype;
  week_json jsonb;
  day_json jsonb;
  row_json jsonb;
  week_id uuid;
  day_id uuid;
  row_id uuid;
  keep_week_ids uuid[] := array[]::uuid[];
  keep_day_ids uuid[] := array[]::uuid[];
  keep_row_ids uuid[] := array[]::uuid[];
begin
  if not public.current_user_has_role('coach') then
    raise exception using errcode = '42501', message = 'Coach access required';
  end if;
  select * into current_program from public.programs
    where id = p_program_id and coach_id = (select auth.uid()) for update;
  if not found then
    raise exception using errcode = '42501', message = 'Program not found';
  end if;
  if current_program.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = '40001', message = 'program_conflict';
  end if;
  if jsonb_typeof(p_document->'weeks') is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Program weeks must be an array';
  end if;

  update public.programs set
    name = coalesce(nullif(btrim(p_document#>>'{program,name}'), ''), name),
    unit = coalesce(p_document#>>'{program,unit}', unit),
    description = p_document#>>'{program,description}'
  where id = p_program_id;

  for week_json in select value from jsonb_array_elements(p_document->'weeks') loop
    week_id := coalesce(nullif(week_json->>'id', '')::uuid, gen_random_uuid());
    if exists (select 1 from public.weeks where id = week_id and program_id <> p_program_id) then
      raise exception using errcode = '22023', message = 'Week does not belong to this program';
    end if;
    keep_week_ids := array_append(keep_week_ids, week_id);
    insert into public.weeks (id, program_id, week_number, name, notes)
    values (week_id, p_program_id, (week_json->>'week_number')::integer,
      coalesce(week_json->>'name', ''), week_json->>'notes')
    on conflict (id) do update set week_number = excluded.week_number, name = excluded.name, notes = excluded.notes;

    for day_json in select value from jsonb_array_elements(coalesce(week_json->'days', '[]'::jsonb)) loop
      day_id := coalesce(nullif(day_json->>'id', '')::uuid, gen_random_uuid());
      if exists (
        select 1 from public.days d join public.weeks w on w.id = d.week_id
        where d.id = day_id and w.program_id <> p_program_id
      ) then
        raise exception using errcode = '22023', message = 'Day does not belong to this program';
      end if;
      keep_day_ids := array_append(keep_day_ids, day_id);
      insert into public.days (id, week_id, day_number, name, notes)
      values (day_id, week_id, (day_json->>'day_number')::integer,
        coalesce(day_json->>'name', ''), day_json->>'notes')
      on conflict (id) do update set week_id = excluded.week_id,
        day_number = excluded.day_number, name = excluded.name, notes = excluded.notes;

      for row_json in select value from jsonb_array_elements(coalesce(day_json->'exercises', '[]'::jsonb)) loop
        row_id := coalesce(nullif(row_json->>'id', '')::uuid, gen_random_uuid());
        if exists (
          select 1 from public.program_exercises pe join public.days d on d.id = pe.day_id
          join public.weeks w on w.id = d.week_id
          where pe.id = row_id and w.program_id <> p_program_id
        ) then
          raise exception using errcode = '22023', message = 'Exercise row does not belong to this program';
        end if;
        keep_row_ids := array_append(keep_row_ids, row_id);
        insert into public.program_exercises (
          id, day_id, exercise_id, position, set_type, sets, reps, reps_min, reps_max,
          rpe, load_mode, load_value, load_min, load_max, percent_of, notes_coach, superset_group
        ) values (
          row_id, day_id, (row_json->>'exercise_id')::uuid,
          coalesce((row_json->>'position')::integer, 0),
          case when row_json ? 'set_type' then nullif(row_json->>'set_type', '')::public.program_set_type else 'working'::public.program_set_type end,
          case when row_json ? 'sets' then nullif(row_json->>'sets', '')::integer else 3 end,
          coalesce(row_json->>'reps', '5'),
          nullif(row_json->>'reps_min', '')::integer, nullif(row_json->>'reps_max', '')::integer,
          nullif(row_json->>'rpe', '')::numeric, coalesce((row_json->>'load_mode')::public.program_load_mode, 'none'),
          nullif(row_json->>'load_value', '')::numeric, nullif(row_json->>'load_min', '')::numeric,
          nullif(row_json->>'load_max', '')::numeric, nullif(row_json->>'percent_of', ''),
          row_json->>'notes_coach', row_json->>'superset_group'
        ) on conflict (id) do update set
          day_id = excluded.day_id, exercise_id = excluded.exercise_id, position = excluded.position,
          set_type = excluded.set_type, sets = excluded.sets, reps = excluded.reps,
          reps_min = excluded.reps_min, reps_max = excluded.reps_max, rpe = excluded.rpe,
          load_mode = excluded.load_mode, load_value = excluded.load_value,
          load_min = excluded.load_min, load_max = excluded.load_max,
          percent_of = excluded.percent_of, notes_coach = excluded.notes_coach,
          superset_group = excluded.superset_group;
      end loop;
    end loop;
  end loop;

  delete from public.weeks where program_id = p_program_id and not (id = any(keep_week_ids));
  delete from public.days d using public.weeks w
    where w.id = d.week_id and w.program_id = p_program_id
      and not (d.id = any(keep_day_ids));
  delete from public.program_exercises pe using public.days d, public.weeks w
    where d.id = pe.day_id and w.id = d.week_id and w.program_id = p_program_id
      and not (pe.id = any(keep_row_ids));

  select updated_at into current_program.updated_at from public.programs where id = p_program_id;
  return current_program.updated_at;
end;
$$;

revoke all on function public.save_coach_program_document(uuid, timestamptz, jsonb) from public, anon;
grant execute on function public.save_coach_program_document(uuid, timestamptz, jsonb) to authenticated;

comment on table public.programs is 'Coach-owned editable program documents. Assignment-backed athlete access is deferred until M4.';
comment on table public.athlete_maxes is 'Dated athlete e1RMs; coach reads require an active coach-athlete link.';
