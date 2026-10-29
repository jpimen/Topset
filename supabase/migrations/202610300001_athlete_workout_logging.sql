alter table public.program_assignments
  add constraint program_assignments_id_athlete_key unique (id, athlete_id);

create table public.workout_sessions (
  id uuid primary key,
  assignment_id uuid not null,
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  day_id uuid not null,
  session_date date not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_session_assignment_athlete_fkey foreign key (assignment_id, athlete_id)
    references public.program_assignments (id, athlete_id) on delete cascade
);
create index workout_sessions_athlete_assignment_date_idx
  on public.workout_sessions (athlete_id, assignment_id, session_date desc);
create index workout_sessions_assignment_day_status_idx
  on public.workout_sessions (assignment_id, day_id, completed_at);

create table public.logged_sets (
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  program_exercise_id uuid not null,
  set_number integer not null check (set_number between 1 and 100),
  load_lifted numeric(9, 2) check (load_lifted is null or load_lifted between 0 and 10000),
  rpe_lifted numeric(3, 1) check (rpe_lifted is null or (rpe_lifted between 1 and 10 and rpe_lifted * 2 = trunc(rpe_lifted * 2))),
  notes_athlete text check (notes_athlete is null or char_length(notes_athlete) <= 2000),
  updated_at timestamptz not null default now(),
  primary key (session_id, program_exercise_id, set_number)
);
create index logged_sets_exercise_idx on public.logged_sets (program_exercise_id, session_id);

drop policy if exists "athletes read exercises in live assignments" on public.exercises;
create policy "athletes read exercises in live assignments" on public.exercises
  for select to authenticated using (
    public.current_user_has_role('athlete')
    and public.athlete_has_live_assigned_exercise(id, (select auth.uid()))
  );

create function public.athlete_can_access_workout_day(
  p_assignment_id uuid,
  p_day_id uuid,
  p_program_exercise_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.program_assignments a
    where a.id = p_assignment_id
      and a.athlete_id = (select auth.uid())
      and a.status = 'active'
      and a.start_date <= current_date
      and public.is_active_coach_athlete(a.coach_id, a.athlete_id)
      and case
        when a.sync_mode = 'snapshot' then exists (
          select 1
          from jsonb_array_elements(coalesce(a.program_snapshot -> 'weeks', '[]'::jsonb)) w
          cross join lateral jsonb_array_elements(coalesce(w -> 'days', '[]'::jsonb)) d
          where d ->> 'id' = p_day_id::text
            and (p_program_exercise_id is null or exists (
              select 1
              from jsonb_array_elements(coalesce(d -> 'exercises', '[]'::jsonb)) e
              where e ->> 'id' = p_program_exercise_id::text
            ))
        )
        else exists (
          select 1 from public.days d
          join public.weeks w on w.id = d.week_id
          where d.id = p_day_id and w.program_id = a.program_id
            and (p_program_exercise_id is null or exists (
              select 1 from public.program_exercises pe
              where pe.id = p_program_exercise_id and pe.day_id = d.id
            ))
        )
      end
  );
$$;

create function public.can_read_workout_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workout_sessions s
    join public.program_assignments a on a.id = s.assignment_id
    where s.id = p_session_id
      and a.status = 'active'
      and a.start_date <= current_date
      and public.is_active_coach_athlete(a.coach_id, a.athlete_id)
      and (
        (public.current_user_has_role('athlete') and s.athlete_id = (select auth.uid()))
        or (public.current_user_has_role('coach') and a.coach_id = (select auth.uid()))
      )
  );
$$;

alter table public.workout_sessions enable row level security;
alter table public.logged_sets enable row level security;

create policy "athletes and linked coaches read workout sessions" on public.workout_sessions
  for select to authenticated using (public.can_read_workout_session(id));
create policy "athletes and linked coaches read logged sets" on public.logged_sets
  for select to authenticated using (public.can_read_workout_session(session_id));

revoke all on public.workout_sessions, public.logged_sets from public, anon, authenticated;
grant select on public.workout_sessions, public.logged_sets to authenticated;

create function public.save_athlete_workout_session(
  p_session_id uuid,
  p_assignment_id uuid,
  p_day_id uuid,
  p_session_date date,
  p_completed boolean,
  p_sets jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  requesting_athlete uuid := (select auth.uid());
  item jsonb;
  item_exercise uuid;
  item_set_number integer;
  item_load numeric;
  item_rpe numeric;
  item_notes text;
  current_session public.workout_sessions%rowtype;
  written_session_id uuid;
begin
  if requesting_athlete is null or not public.current_user_has_role('athlete') then
    raise exception using errcode = '42501', message = 'athlete_only';
  end if;
  if p_session_id is null or p_session_date is null or p_completed is null
    or coalesce(jsonb_typeof(p_sets) <> 'array', true)
    or coalesce(case when jsonb_typeof(p_sets) = 'array' then jsonb_array_length(p_sets) end, 0) > 1000
    or not public.athlete_can_access_workout_day(p_assignment_id, p_day_id) then
    raise exception using errcode = '22023', message = 'workout_details_invalid';
  end if;

  select * into current_session from public.workout_sessions s
  where s.id = p_session_id for update;
  if found and (current_session.athlete_id <> requesting_athlete
    or current_session.assignment_id <> p_assignment_id or current_session.day_id <> p_day_id) then
    raise exception using errcode = '42501', message = 'workout_session_not_owned';
  end if;

  insert into public.workout_sessions (id, assignment_id, athlete_id, day_id, session_date, completed_at)
  values (p_session_id, p_assignment_id, requesting_athlete, p_day_id, p_session_date,
    case when p_completed then clock_timestamp() else null end)
  on conflict (id) do update set
    session_date = excluded.session_date,
    completed_at = case when p_completed then coalesce(public.workout_sessions.completed_at, clock_timestamp()) else null end,
    updated_at = clock_timestamp()
  where public.workout_sessions.athlete_id = requesting_athlete
    and public.workout_sessions.assignment_id = p_assignment_id
    and public.workout_sessions.day_id = p_day_id
  returning id into written_session_id;
  if not found then
    raise exception using errcode = '42501', message = 'workout_session_not_owned';
  end if;

  delete from public.logged_sets where session_id = p_session_id;
  for item in select value from jsonb_array_elements(p_sets)
  loop
    if jsonb_typeof(item) <> 'object'
      or coalesce(item ->> 'program_exercise_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or coalesce(item ->> 'set_number', '') !~ '^[1-9][0-9]{0,2}$' then
      raise exception using errcode = '22023', message = 'workout_set_invalid';
    end if;
    item_exercise := (item ->> 'program_exercise_id')::uuid;
    item_set_number := (item ->> 'set_number')::integer;
    if item_set_number > 100 or not public.athlete_can_access_workout_day(p_assignment_id, p_day_id, item_exercise) then
      raise exception using errcode = '42501', message = 'workout_exercise_not_assigned';
    end if;

    if item ? 'load_lifted' and item -> 'load_lifted' <> 'null'::jsonb then
      if jsonb_typeof(item -> 'load_lifted') <> 'number' then
        raise exception using errcode = '22023', message = 'workout_load_invalid';
      end if;
      item_load := (item ->> 'load_lifted')::numeric;
      if item_load < 0 or item_load > 10000 then
        raise exception using errcode = '22023', message = 'workout_load_invalid';
      end if;
    else item_load := null; end if;

    if item ? 'rpe_lifted' and item -> 'rpe_lifted' <> 'null'::jsonb then
      if jsonb_typeof(item -> 'rpe_lifted') <> 'number' then
        raise exception using errcode = '22023', message = 'workout_rpe_invalid';
      end if;
      item_rpe := (item ->> 'rpe_lifted')::numeric;
      if item_rpe < 1 or item_rpe > 10 or item_rpe * 2 <> trunc(item_rpe * 2) then
        raise exception using errcode = '22023', message = 'workout_rpe_invalid';
      end if;
    else item_rpe := null; end if;

    item_notes := case when item ? 'notes_athlete' and item -> 'notes_athlete' <> 'null'::jsonb then item ->> 'notes_athlete' else null end;
    if item ? 'notes_athlete' and item -> 'notes_athlete' <> 'null'::jsonb
      and jsonb_typeof(item -> 'notes_athlete') <> 'string' then
      raise exception using errcode = '22023', message = 'workout_notes_invalid';
    end if;
    if char_length(coalesce(item_notes, '')) > 2000 then
      raise exception using errcode = '22023', message = 'workout_notes_invalid';
    end if;

    insert into public.logged_sets (session_id, program_exercise_id, set_number, load_lifted, rpe_lifted, notes_athlete)
    values (p_session_id, item_exercise, item_set_number, item_load, item_rpe, item_notes);
  end loop;
end;
$$;

revoke all on function public.athlete_can_access_workout_day(uuid, uuid, uuid) from public, anon;
revoke all on function public.can_read_workout_session(uuid) from public, anon;
revoke all on function public.save_athlete_workout_session(uuid, uuid, uuid, date, boolean, jsonb) from public, anon;
grant execute on function public.athlete_can_access_workout_day(uuid, uuid, uuid) to authenticated;
grant execute on function public.can_read_workout_session(uuid) to authenticated;
grant execute on function public.save_athlete_workout_session(uuid, uuid, uuid, date, boolean, jsonb) to authenticated;

comment on table public.workout_sessions is 'Athlete session records. Client-generated UUIDs make offline replay idempotent.';
comment on table public.logged_sets is 'Per-set athlete logs associated with the exact program exercise in a session.';
comment on function public.save_athlete_workout_session(uuid, uuid, uuid, date, boolean, jsonb) is 'Validates current assignment access and atomically replaces one session’s logged sets.';
