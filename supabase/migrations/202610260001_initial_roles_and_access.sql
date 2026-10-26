create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('coach', 'athlete')),
  name text not null check (char_length(name) between 2 and 80),
  team_name text check (team_name is null or char_length(team_name) <= 100),
  unit text check (unit is null or unit in ('kg', 'lb')),
  bodyweight numeric(7, 2) check (bodyweight is null or bodyweight > 0),
  weight_class text check (weight_class is null or char_length(weight_class) <= 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.coach_athlete_links (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_and_athlete_are_different check (coach_id <> athlete_id)
);

create unique index coach_athlete_one_active_coach_per_athlete
  on public.coach_athlete_links (athlete_id)
  where status = 'active';
create index coach_athlete_links_coach_status_idx
  on public.coach_athlete_links (coach_id, status);
create index coach_athlete_links_athlete_status_idx
  on public.coach_athlete_links (athlete_id, status);

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index programs_coach_id_idx on public.programs (coach_id);

create table public.program_assignments (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  coach_id uuid not null references public.profiles (id) on delete cascade,
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  start_date date not null,
  sync_mode text not null check (sync_mode in ('live', 'snapshot')),
  created_at timestamptz not null default now(),
  constraint program_assignment_one_per_athlete unique (program_id, athlete_id)
);
create index program_assignments_athlete_start_idx
  on public.program_assignments (athlete_id, start_date desc);
create index program_assignments_coach_idx on public.program_assignments (coach_id);

create function public.current_user_has_role(expected_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = expected_role
  );
$$;

create function public.is_active_coach_athlete(check_coach_id uuid, check_athlete_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.coach_athlete_links l
    where l.coach_id = check_coach_id
      and l.athlete_id = check_athlete_id
      and l.status = 'active'
  );
$$;

create function public.owns_program(check_program_id uuid, check_coach_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.programs p
    where p.id = check_program_id
      and p.coach_id = check_coach_id
  );
$$;

revoke all on function public.current_user_has_role(text) from public, anon;
revoke all on function public.is_active_coach_athlete(uuid, uuid) from public, anon;
revoke all on function public.owns_program(uuid, uuid) from public, anon;
grant execute on function public.current_user_has_role(text) to authenticated;
grant execute on function public.is_active_coach_athlete(uuid, uuid) to authenticated;
grant execute on function public.owns_program(uuid, uuid) to authenticated;

create function public.create_profile_for_new_user()
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
  return new;
end;
$$;

create trigger on_auth_user_created_create_profile
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

create function public.protect_profile_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.role is distinct from old.role or new.created_at is distinct from old.created_at then
    raise exception 'Account identity and role cannot be changed';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger protect_profile_identity_before_update
  before update on public.profiles
  for each row execute function public.protect_profile_identity();

grant select, update on public.profiles to authenticated;
grant select, delete on public.coach_athlete_links to authenticated;
grant select, insert, update, delete on public.programs to authenticated;
grant select, insert, update, delete on public.program_assignments to authenticated;

alter table public.profiles enable row level security;
alter table public.coach_athlete_links enable row level security;
alter table public.programs enable row level security;
alter table public.program_assignments enable row level security;

create policy "users read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "coaches read active athletes" on public.profiles
  for select to authenticated using (
    role = 'athlete'
    and public.current_user_has_role('coach')
    and public.is_active_coach_athlete((select auth.uid()), id)
  );
create policy "athletes read active coach profile" on public.profiles
  for select to authenticated using (
    role = 'coach'
    and public.current_user_has_role('athlete')
    and public.is_active_coach_athlete(id, (select auth.uid()))
  );
create policy "users update own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "linked users read link" on public.coach_athlete_links
  for select to authenticated using (
    coach_id = (select auth.uid()) or athlete_id = (select auth.uid())
  );
create policy "coaches remove own links" on public.coach_athlete_links
  for delete to authenticated using (
    coach_id = (select auth.uid()) and public.current_user_has_role('coach')
  );

create policy "coaches manage own programs" on public.programs
  for all to authenticated
  using (coach_id = (select auth.uid()) and public.current_user_has_role('coach'))
  with check (coach_id = (select auth.uid()) and public.current_user_has_role('coach'));
create policy "athletes read assigned programs" on public.programs
  for select to authenticated using (
    exists (
      select 1 from public.program_assignments a
      where a.program_id = id
        and a.athlete_id = (select auth.uid())
        and public.is_active_coach_athlete(a.coach_id, a.athlete_id)
    )
  );

create policy "coaches manage assignments for linked athletes" on public.program_assignments
  for all to authenticated
  using (
    coach_id = (select auth.uid())
    and public.current_user_has_role('coach')
    and public.owns_program(program_id, (select auth.uid()))
    and public.is_active_coach_athlete(coach_id, athlete_id)
  )
  with check (
    coach_id = (select auth.uid())
    and public.current_user_has_role('coach')
    and public.owns_program(program_id, (select auth.uid()))
    and public.is_active_coach_athlete(coach_id, athlete_id)
  );
create policy "athletes read own active assignments" on public.program_assignments
  for select to authenticated using (
    athlete_id = (select auth.uid())
    and public.is_active_coach_athlete(coach_id, athlete_id)
  );

comment on table public.profiles is 'Minimal role and onboarding profile; account role is fixed at signup.';
comment on table public.program_assignments is 'Assignment access foundation. Snapshot storage and program versions are added with program building.';
