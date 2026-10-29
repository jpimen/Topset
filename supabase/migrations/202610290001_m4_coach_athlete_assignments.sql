create table public.coach_invite_codes (
  coach_id uuid primary key references public.profiles (id) on delete cascade,
  code_hash bytea not null unique,
  created_at timestamptz not null default now()
);

revoke all on public.coach_invite_codes from public, anon, authenticated;

with duplicate_pending as (
  select id, row_number() over (partition by athlete_id order by created_at desc, id desc) as request_order
  from public.coach_athlete_links where status = 'pending'
)
update public.coach_athlete_links l set status = 'removed', updated_at = clock_timestamp()
from duplicate_pending d where d.id = l.id and d.request_order > 1;

create unique index coach_athlete_one_pending_request_per_athlete
  on public.coach_athlete_links (athlete_id)
  where status = 'pending';

drop policy if exists "coaches read active athletes" on public.profiles;
create policy "coaches read requested and active athletes" on public.profiles
  for select to authenticated using (
    role = 'athlete'
    and public.current_user_has_role('coach')
    and exists (
      select 1 from public.coach_athlete_links l
      where l.coach_id = (select auth.uid())
        and l.athlete_id = profiles.id
        and l.status in ('pending', 'active')
    )
  );
drop policy if exists "athletes read active coach profile" on public.profiles;
create policy "athletes read pending and active coach profile" on public.profiles
  for select to authenticated using (
    role = 'coach'
    and public.current_user_has_role('athlete')
    and exists (
      select 1 from public.coach_athlete_links l
      where l.coach_id = profiles.id and l.athlete_id = (select auth.uid())
        and l.status in ('pending', 'active')
    )
  );

revoke delete on public.coach_athlete_links from authenticated;
drop policy if exists "coaches remove own links" on public.coach_athlete_links;

create or replace function public.make_coach_invite_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  generated_code text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if not public.current_user_has_role('coach') then
    raise exception using errcode = '42501', message = 'coach_only';
  end if;

  insert into public.coach_invite_codes (coach_id, code_hash)
  values ((select auth.uid()), extensions.digest(convert_to(generated_code, 'UTF8'), 'sha256'))
  on conflict (coach_id) do update
    set code_hash = excluded.code_hash, created_at = clock_timestamp();
  return generated_code;
end;
$$;

create or replace function public.is_coach_invite_code_valid(p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    p_code ~ '^[a-f0-9]{48}$'
    and exists (
      select 1 from public.coach_invite_codes c
      where c.code_hash = extensions.digest(convert_to(lower(p_code), 'UTF8'), 'sha256')
    ),
    false
  );
$$;

create or replace function public.request_coach_link(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  requesting_athlete uuid := (select auth.uid());
  target_coach uuid;
  existing_link public.coach_athlete_links%rowtype;
  created_link uuid;
begin
  if requesting_athlete is null or not public.current_user_has_role('athlete') then
    raise exception using errcode = '42501', message = 'athlete_only';
  end if;

  if p_code is null or p_code !~ '^[a-fA-F0-9]{48}$' then
    raise exception using errcode = '22023', message = 'invite_code_invalid';
  end if;

  select c.coach_id into target_coach
  from public.coach_invite_codes c
  where c.code_hash = extensions.digest(convert_to(lower(p_code), 'UTF8'), 'sha256');
  if target_coach is null then
    raise exception using errcode = '22023', message = 'invite_code_invalid';
  end if;

  perform 1 from public.profiles p where p.id = requesting_athlete for update;
  if public.is_active_coach_athlete(target_coach, requesting_athlete) then
    raise exception using errcode = '23505', message = 'already_linked_to_coach';
  end if;

  select * into existing_link from public.coach_athlete_links l
  where l.athlete_id = requesting_athlete and l.status = 'pending' for update;
  if found then
    if existing_link.coach_id = target_coach then return existing_link.id; end if;
    raise exception using errcode = '23505', message = 'link_request_already_pending';
  end if;

  insert into public.coach_athlete_links (coach_id, athlete_id, status)
  values (target_coach, requesting_athlete, 'pending')
  returning id into created_link;
  return created_link;
end;
$$;

create or replace function public.respond_to_coach_link(p_link_id uuid, p_approve boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_link public.coach_athlete_links%rowtype;
begin
  if (select auth.uid()) is null or not public.current_user_has_role('coach') then
    raise exception using errcode = '42501', message = 'coach_only';
  end if;

  select * into target_link from public.coach_athlete_links l
  where l.id = p_link_id and l.coach_id = (select auth.uid()) for update;
  if not found then raise exception using errcode = 'P0002', message = 'link_request_not_found'; end if;

  if target_link.status <> 'pending' then
    if p_approve and target_link.status = 'active' then return 'active'; end if;
    raise exception using errcode = '22023', message = 'link_request_not_pending';
  end if;

  perform 1 from public.profiles p where p.id = target_link.athlete_id for update;
  if p_approve and exists (
    select 1 from public.coach_athlete_links l
    where l.athlete_id = target_link.athlete_id and l.status = 'active'
  ) then
    raise exception using errcode = '23505', message = 'athlete_already_linked';
  end if;

  update public.coach_athlete_links
  set status = case when p_approve then 'active' else 'removed' end,
      updated_at = clock_timestamp()
  where id = p_link_id;
  return case when p_approve then 'active' else 'removed' end;
end;
$$;

create or replace function public.remove_coach_athlete_link(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.current_user_has_role('coach') then
    raise exception using errcode = '42501', message = 'coach_only';
  end if;

  update public.coach_athlete_links
  set status = 'removed', updated_at = clock_timestamp()
  where id = p_link_id and coach_id = (select auth.uid()) and status in ('pending', 'active');
  if not found then raise exception using errcode = 'P0002', message = 'link_not_found'; end if;
end;
$$;

create or replace function public.attach_signup_invite_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  signup_code text;
  target_coach uuid;
begin
  if new.role <> 'athlete' then return new; end if;

  select u.raw_user_meta_data ->> 'invite_code' into signup_code
  from auth.users u where u.id = new.id;
  if signup_code is null or signup_code !~ '^[a-fA-F0-9]{48}$' then return new; end if;

  select c.coach_id into target_coach
  from public.coach_invite_codes c
  where c.code_hash = extensions.digest(convert_to(lower(signup_code), 'UTF8'), 'sha256');
  if target_coach is null then return new; end if;

  insert into public.coach_athlete_links (coach_id, athlete_id, status)
  select target_coach, new.id, 'pending'
  where not exists (
    select 1 from public.coach_athlete_links l
    where l.athlete_id = new.id and l.status in ('pending', 'active')
  );
  return new;
end;
$$;

create trigger attach_signup_invite_request_after_profile
  after insert on public.profiles
  for each row execute function public.attach_signup_invite_request();

alter table public.program_assignments
  drop constraint if exists program_assignment_one_per_athlete,
  add column status text not null default 'active' check (status in ('active', 'ended')),
  add column program_snapshot jsonb;

with duplicate_active as (
  select id, row_number() over (partition by athlete_id order by start_date desc, created_at desc, id desc) as assignment_order
  from public.program_assignments where status = 'active'
)
update public.program_assignments a set status = 'ended'
from duplicate_active d where d.id = a.id and d.assignment_order > 1;

create unique index program_assignments_one_active_per_athlete
  on public.program_assignments (athlete_id) where status = 'active';
create index program_assignments_coach_status_idx
  on public.program_assignments (coach_id, status, start_date desc);

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
              select jsonb_agg(to_jsonb(pe) || jsonb_build_object('exercise', to_jsonb(e)) order by pe.position)
              from public.program_exercises pe
              join public.exercises e on e.id = pe.exercise_id
              where pe.day_id = d.id
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

update public.program_assignments a
set program_snapshot = public.snapshot_coach_program(a.program_id)
where a.sync_mode = 'snapshot';

alter table public.program_assignments
  add constraint program_assignment_snapshot_check check (
    (sync_mode = 'snapshot' and program_snapshot is not null)
    or (sync_mode = 'live' and program_snapshot is null)
  );

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
  if (select count(distinct x)::integer from unnest(p_athlete_ids) x) <> array_length(p_athlete_ids, 1) then
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

create or replace function public.end_program_assignment(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.current_user_has_role('coach') then
    raise exception using errcode = '42501', message = 'coach_only';
  end if;
  update public.program_assignments a set status = 'ended'
  where a.id = p_assignment_id and a.coach_id = (select auth.uid()) and a.status = 'active';
  if not found then raise exception using errcode = 'P0002', message = 'assignment_not_found'; end if;
end;
$$;

drop policy if exists "athletes read assigned programs" on public.programs;
create policy "athletes read assigned live programs" on public.programs
  for select to authenticated using (
    exists (
      select 1 from public.program_assignments a
      where a.program_id = programs.id and a.athlete_id = (select auth.uid())
        and a.status = 'active' and a.sync_mode = 'live'
        and public.is_active_coach_athlete(a.coach_id, a.athlete_id)
    )
  );

create policy "athletes read assigned live blocks" on public.blocks
  for select to authenticated using (
    exists (select 1 from public.program_assignments a where a.program_id = blocks.program_id
      and a.athlete_id = (select auth.uid()) and a.status = 'active' and a.sync_mode = 'live'
      and public.is_active_coach_athlete(a.coach_id, a.athlete_id))
  );
create policy "athletes read assigned live weeks" on public.weeks
  for select to authenticated using (
    exists (select 1 from public.program_assignments a where a.program_id = weeks.program_id
      and a.athlete_id = (select auth.uid()) and a.status = 'active' and a.sync_mode = 'live'
      and public.is_active_coach_athlete(a.coach_id, a.athlete_id))
  );
create policy "athletes read assigned live days" on public.days
  for select to authenticated using (
    exists (select 1 from public.weeks w join public.program_assignments a on a.program_id = w.program_id
      where w.id = days.week_id and a.athlete_id = (select auth.uid()) and a.status = 'active' and a.sync_mode = 'live'
      and public.is_active_coach_athlete(a.coach_id, a.athlete_id))
  );
create policy "athletes read assigned live exercises" on public.program_exercises
  for select to authenticated using (
    exists (select 1 from public.days d join public.weeks w on w.id = d.week_id
      join public.program_assignments a on a.program_id = w.program_id
      where d.id = program_exercises.day_id and a.athlete_id = (select auth.uid())
        and a.status = 'active' and a.sync_mode = 'live'
        and public.is_active_coach_athlete(a.coach_id, a.athlete_id))
  );
create policy "athletes read exercises in live assignments" on public.exercises
  for select to authenticated using (
    exists (select 1 from public.program_exercises pe join public.days d on d.id = pe.day_id
      join public.weeks w on w.id = d.week_id join public.program_assignments a on a.program_id = w.program_id
      where pe.exercise_id = exercises.id and a.athlete_id = (select auth.uid())
        and a.status = 'active' and a.sync_mode = 'live'
        and public.is_active_coach_athlete(a.coach_id, a.athlete_id))
  );

drop policy "coaches manage assignments for linked athletes" on public.program_assignments;
drop policy "athletes read own active assignments" on public.program_assignments;
create policy "coaches read own assignments" on public.program_assignments
  for select to authenticated using (coach_id = (select auth.uid()) and public.current_user_has_role('coach'));
create policy "athletes read own active assignments" on public.program_assignments
  for select to authenticated using (
    athlete_id = (select auth.uid()) and status = 'active'
    and public.is_active_coach_athlete(coach_id, athlete_id)
  );

revoke insert, update, delete on public.program_assignments from authenticated;
grant select on public.program_assignments to authenticated;

revoke all on function public.make_coach_invite_code() from public, anon;
revoke all on function public.is_coach_invite_code_valid(text) from public;
revoke all on function public.request_coach_link(text) from public, anon;
revoke all on function public.respond_to_coach_link(uuid, boolean) from public, anon;
revoke all on function public.remove_coach_athlete_link(uuid) from public, anon;
revoke all on function public.attach_signup_invite_request() from public, anon, authenticated;
revoke all on function public.snapshot_coach_program(uuid) from public, anon, authenticated;
revoke all on function public.assign_program_to_athletes(uuid, uuid[], date, text) from public, anon;
revoke all on function public.end_program_assignment(uuid) from public, anon;
grant execute on function public.make_coach_invite_code() to authenticated;
grant execute on function public.is_coach_invite_code_valid(text) to anon, authenticated;
grant execute on function public.request_coach_link(text) to authenticated;
grant execute on function public.respond_to_coach_link(uuid, boolean) to authenticated;
grant execute on function public.remove_coach_athlete_link(uuid) to authenticated;
grant execute on function public.assign_program_to_athletes(uuid, uuid[], date, text) to authenticated;
grant execute on function public.end_program_assignment(uuid) to authenticated;

comment on table public.coach_invite_codes is 'One hashed, rotatable share code per coach. Plaintext is returned only when generated.';
comment on column public.program_assignments.program_snapshot is 'Immutable program document captured when sync_mode is snapshot.';
