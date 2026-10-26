alter table public.profiles
  add column squat_max numeric(7, 2) constraint profiles_squat_max_valid
    check (squat_max is null or (squat_max > 0 and squat_max <= 2000)),
  add column bench_max numeric(7, 2) constraint profiles_bench_max_valid
    check (bench_max is null or (bench_max > 0 and bench_max <= 2000)),
  add column deadlift_max numeric(7, 2) constraint profiles_deadlift_max_valid
    check (deadlift_max is null or (deadlift_max > 0 and deadlift_max <= 2000));

create function public.store_profile_lifting_maxes_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen_squat numeric;
  chosen_bench numeric;
  chosen_deadlift numeric;
  raw_value text;
begin
  if new.raw_user_meta_data ->> 'role' <> 'athlete' then
    return new;
  end if;

  raw_value := nullif(btrim(new.raw_user_meta_data ->> 'squat_max'), '');
  if raw_value is not null then
    begin
      chosen_squat := raw_value::numeric;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Squat max must be a valid number';
    end;
    if chosen_squat::text = 'NaN' or chosen_squat <= 0 or chosen_squat > 2000 then
      raise exception 'Squat max must be greater than zero and at most 2000';
    end if;
  end if;

  raw_value := nullif(btrim(new.raw_user_meta_data ->> 'bench_max'), '');
  if raw_value is not null then
    begin
      chosen_bench := raw_value::numeric;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Bench max must be a valid number';
    end;
    if chosen_bench::text = 'NaN' or chosen_bench <= 0 or chosen_bench > 2000 then
      raise exception 'Bench max must be greater than zero and at most 2000';
    end if;
  end if;

  raw_value := nullif(btrim(new.raw_user_meta_data ->> 'deadlift_max'), '');
  if raw_value is not null then
    begin
      chosen_deadlift := raw_value::numeric;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Deadlift max must be a valid number';
    end;
    if chosen_deadlift::text = 'NaN' or chosen_deadlift <= 0 or chosen_deadlift > 2000 then
      raise exception 'Deadlift max must be greater than zero and at most 2000';
    end if;
  end if;

  update public.profiles
  set squat_max = chosen_squat,
      bench_max = chosen_bench,
      deadlift_max = chosen_deadlift
  where id = new.id and role = 'athlete';

  return new;
end;
$$;

create trigger store_profile_lifting_maxes_after_signup
  after insert on auth.users
  for each row execute function public.store_profile_lifting_maxes_for_new_user();

revoke all on function public.store_profile_lifting_maxes_for_new_user() from public, anon, authenticated;

-- Keep the assignment-based athlete access scoped to the outer program row.
drop policy "athletes read assigned programs" on public.programs;
create policy "athletes read assigned programs" on public.programs
  for select to authenticated using (
    exists (
      select 1 from public.program_assignments a
      where a.program_id = programs.id
        and a.athlete_id = (select auth.uid())
        and public.is_active_coach_athlete(a.coach_id, a.athlete_id)
    )
  );
