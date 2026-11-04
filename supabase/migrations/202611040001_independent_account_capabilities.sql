-- Rollback: drop the new capability-aware profile policies and helper functions,
-- restore the previous role-based definitions from earlier migrations, then drop
-- public.profile_capabilities. Capability grants made after this migration must
-- be reviewed before rollback because `profiles.role` remains the signup persona.

create table public.profile_capabilities (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  capability text not null check (capability in ('coach', 'athlete')),
  created_at timestamptz not null default now(),
  primary key (profile_id, capability)
);

insert into public.profile_capabilities (profile_id, capability)
select id, role from public.profiles
on conflict (profile_id, capability) do nothing;

alter table public.profile_capabilities enable row level security;
revoke all on public.profile_capabilities from public, anon, authenticated;
grant select on public.profile_capabilities to authenticated;
create policy "users read own capabilities" on public.profile_capabilities
  for select to authenticated using (profile_id = (select auth.uid()));

create or replace function public.current_user_has_role(expected_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profile_capabilities c
    where c.profile_id = (select auth.uid())
      and c.capability = expected_role
  );
$$;

revoke all on function public.current_user_has_role(text) from public, anon;
grant execute on function public.current_user_has_role(text) to authenticated;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen_role text := new.raw_user_meta_data ->> 'role';
  chosen_name text := btrim(coalesce(new.raw_user_meta_data ->> 'name', ''));
  chosen_weight numeric;
begin
  if chosen_role is null or chosen_role not in ('coach', 'athlete') then
    raise exception 'Choose coach or athlete when creating your account';
  end if;
  if char_length(chosen_name) < 2 or char_length(chosen_name) > 80 then
    raise exception 'Name must be between 2 and 80 characters';
  end if;

  if nullif(new.raw_user_meta_data ->> 'bodyweight', '') is not null then
    begin
      chosen_weight := (new.raw_user_meta_data ->> 'bodyweight')::numeric;
    exception when invalid_text_representation then
      raise exception 'Bodyweight must be a valid number';
    end;
    if chosen_weight <= 0 or chosen_weight > 500 then
      raise exception 'Bodyweight must be greater than zero and at most 500';
    end if;
  end if;

  insert into public.profiles (id, role, name, team_name, unit, bodyweight, weight_class)
  values (
    new.id,
    chosen_role,
    chosen_name,
    case when chosen_role = 'coach' then nullif(btrim(new.raw_user_meta_data ->> 'team_name'), '') else null end,
    case when chosen_role = 'athlete' and new.raw_user_meta_data ->> 'unit' in ('kg', 'lb') then new.raw_user_meta_data ->> 'unit' else null end,
    case when chosen_role = 'athlete' then chosen_weight else null end,
    case when chosen_role = 'athlete' then nullif(btrim(new.raw_user_meta_data ->> 'weight_class'), '') else null end
  );
  insert into public.profile_capabilities (profile_id, capability) values (new.id, chosen_role);
  return new;
end;
$$;

create or replace function public.can_read_as_athlete_profile(check_athlete_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_user_has_role('coach') and exists (
    select 1
    from public.coach_athlete_links l
    join public.profile_capabilities c on c.profile_id = l.athlete_id and c.capability = 'athlete'
    where l.coach_id = (select auth.uid())
      and l.athlete_id = check_athlete_id
      and l.status in ('pending', 'active')
  );
$$;

create or replace function public.can_read_as_coach_profile(check_coach_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_user_has_role('athlete') and exists (
    select 1
    from public.coach_athlete_links l
    join public.profile_capabilities c on c.profile_id = l.coach_id and c.capability = 'coach'
    where l.coach_id = check_coach_id
      and l.athlete_id = (select auth.uid())
      and l.status in ('pending', 'active')
  );
$$;

revoke all on function public.can_read_as_athlete_profile(uuid) from public, anon;
revoke all on function public.can_read_as_coach_profile(uuid) from public, anon;
grant execute on function public.can_read_as_athlete_profile(uuid) to authenticated;
grant execute on function public.can_read_as_coach_profile(uuid) to authenticated;

drop policy if exists "coaches read requested and active athletes" on public.profiles;
create policy "coaches read requested and active athletes" on public.profiles
  for select to authenticated using (public.can_read_as_athlete_profile(id));
drop policy if exists "athletes read pending and active coach profile" on public.profiles;
create policy "athletes read pending and active coach profile" on public.profiles
  for select to authenticated using (public.can_read_as_coach_profile(id));

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
  if requesting_athlete is null or not (
    public.current_user_has_role('athlete') or public.current_user_has_role('coach')
  ) then
    raise exception using errcode = '42501', message = 'athlete_or_coach_only';
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
  if target_coach = requesting_athlete then
    raise exception using errcode = '22023', message = 'cannot_link_to_self';
  end if;
  if not exists (
    select 1 from public.profile_capabilities c
    where c.profile_id = target_coach and c.capability = 'coach'
  ) then
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

  insert into public.profile_capabilities (profile_id, capability)
  values (requesting_athlete, 'athlete') on conflict do nothing;
  insert into public.coach_athlete_links (coach_id, athlete_id, status)
  values (target_coach, requesting_athlete, 'pending')
  returning id into created_link;
  return created_link;
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
  if target_coach is null or target_coach = new.id then return new; end if;

  insert into public.coach_athlete_links (coach_id, athlete_id, status)
  select target_coach, new.id, 'pending'
  where not exists (
    select 1 from public.coach_athlete_links l
    where l.athlete_id = new.id and l.status in ('pending', 'active')
  );
  return new;
end;
$$;

create or replace function public.athlete_has_live_assigned_exercise(p_exercise_id uuid, p_athlete_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_athlete_id = (select auth.uid())
    and public.current_user_has_role('athlete')
    and exists (
      select 1
      from public.program_exercises pe
      join public.days d on d.id = pe.day_id
      join public.weeks w on w.id = d.week_id
      join public.program_assignments a on a.program_id = w.program_id
      where pe.exercise_id = p_exercise_id
        and a.athlete_id = p_athlete_id
        and a.status = 'active'
        and a.start_date <= current_date
        and a.sync_mode = 'live'
        and public.is_active_coach_athlete(a.coach_id, a.athlete_id)
    );
$$;

drop policy if exists "athletes read assigned live programs" on public.programs;
create policy "athletes read assigned live programs" on public.programs
  for select to authenticated using (
    public.current_user_has_role('athlete') and exists (
      select 1 from public.program_assignments a
      where a.program_id = programs.id and a.athlete_id = (select auth.uid())
        and a.status = 'active' and a.start_date <= current_date and a.sync_mode = 'live'
        and public.is_active_coach_athlete(a.coach_id, a.athlete_id)
    )
  );

drop policy if exists "athletes read assigned live blocks" on public.blocks;
create policy "athletes read assigned live blocks" on public.blocks
  for select to authenticated using (
    public.current_user_has_role('athlete') and exists (
      select 1 from public.program_assignments a where a.program_id = blocks.program_id
        and a.athlete_id = (select auth.uid()) and a.status = 'active'
        and a.start_date <= current_date and a.sync_mode = 'live'
        and public.is_active_coach_athlete(a.coach_id, a.athlete_id)
    )
  );

drop policy if exists "athletes read assigned live weeks" on public.weeks;
create policy "athletes read assigned live weeks" on public.weeks
  for select to authenticated using (
    public.current_user_has_role('athlete') and exists (
      select 1 from public.program_assignments a where a.program_id = weeks.program_id
        and a.athlete_id = (select auth.uid()) and a.status = 'active'
        and a.start_date <= current_date and a.sync_mode = 'live'
        and public.is_active_coach_athlete(a.coach_id, a.athlete_id)
    )
  );

drop policy if exists "athletes read assigned live days" on public.days;
create policy "athletes read assigned live days" on public.days
  for select to authenticated using (
    public.current_user_has_role('athlete') and exists (
      select 1 from public.weeks w join public.program_assignments a on a.program_id = w.program_id
      where w.id = days.week_id and a.athlete_id = (select auth.uid()) and a.status = 'active'
        and a.start_date <= current_date and a.sync_mode = 'live'
        and public.is_active_coach_athlete(a.coach_id, a.athlete_id)
    )
  );

drop policy if exists "athletes read assigned live exercises" on public.program_exercises;
create policy "athletes read assigned live exercises" on public.program_exercises
  for select to authenticated using (
    public.current_user_has_role('athlete') and exists (
      select 1 from public.days d join public.weeks w on w.id = d.week_id
      join public.program_assignments a on a.program_id = w.program_id
      where d.id = program_exercises.day_id and a.athlete_id = (select auth.uid())
        and a.status = 'active' and a.start_date <= current_date and a.sync_mode = 'live'
        and public.is_active_coach_athlete(a.coach_id, a.athlete_id)
    )
  );

drop policy if exists "athletes read own active assignments" on public.program_assignments;
create policy "athletes read own active assignments" on public.program_assignments
  for select to authenticated using (
    public.current_user_has_role('athlete')
    and athlete_id = (select auth.uid()) and status = 'active' and start_date <= current_date
    and public.is_active_coach_athlete(coach_id, athlete_id)
  );

comment on table public.profile_capabilities is 'Independent Coach and Athlete permissions. Signup initializes one capability; authenticated users cannot grant capabilities directly.';
comment on column public.profiles.role is 'Immutable signup persona retained for compatibility; access checks use profile_capabilities.';
