-- Rollback: drop table public.athlete_personal_programs.
create table public.athlete_personal_programs (
  athlete_id uuid primary key references public.profiles (id) on delete cascade,
  document jsonb not null check (jsonb_typeof(document) = 'object' and pg_column_size(document) <= 524288),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger athlete_personal_programs_set_updated_at
  before update on public.athlete_personal_programs
  for each row execute function public.set_updated_at();

alter table public.athlete_personal_programs enable row level security;
revoke all on public.athlete_personal_programs from public, anon, authenticated;
grant select, insert, update, delete on public.athlete_personal_programs to authenticated;

create policy "athletes manage own private program" on public.athlete_personal_programs
  for all to authenticated
  using (athlete_id = (select auth.uid()) and public.current_user_has_role('athlete'))
  with check (athlete_id = (select auth.uid()) and public.current_user_has_role('athlete'));
