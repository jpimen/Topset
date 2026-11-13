-- Rollback: drop the customization RPC and trigger, restore the original insert
-- policy, then drop the validation function, override index, and base_exercise_id
-- column. Customized copies remain as coach-owned exercises with valid program refs.
alter table public.exercises
  add column base_exercise_id uuid references public.exercises (id) on delete cascade,
  add constraint exercises_base_requires_owner_check
    check (base_exercise_id is null or owner_id is not null);

create unique index exercises_owner_builtin_override_idx
  on public.exercises (owner_id, base_exercise_id)
  where owner_id is not null and base_exercise_id is not null;

create function public.validate_exercise_base()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.base_exercise_id is distinct from old.base_exercise_id then
    raise exception using errcode = '22023', message = 'An exercise override source cannot be changed.';
  end if;

  if new.base_exercise_id is not null and not exists (
    select 1 from public.exercises e
    where e.id = new.base_exercise_id and e.owner_id is null
  ) then
    raise exception using errcode = '22023', message = 'An exercise override must reference a built-in exercise.';
  end if;
  return new;
end;
$$;

create trigger exercises_validate_base
  before insert or update of base_exercise_id, owner_id on public.exercises
  for each row execute function public.validate_exercise_base();

drop policy "coaches create own exercises" on public.exercises;
create policy "coaches create own exercises" on public.exercises
  for insert to authenticated with check (
    public.current_user_has_role('coach')
    and owner_id = (select auth.uid())
    and base_exercise_id is null
  );

create function public.customize_builtin_exercise(
  p_exercise_id uuid,
  p_name text,
  p_category public.exercise_category,
  p_movement public.exercise_movement,
  p_muscle_group text,
  p_is_competition_lift boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  coach_id uuid := (select auth.uid());
  customized_id uuid;
begin
  if coach_id is null or not public.current_user_has_role('coach') then
    raise exception using errcode = '42501', message = 'Only coaches can customize built-in exercises.';
  end if;

  if p_name is null or char_length(btrim(p_name)) not between 1 and 120
     or p_category is null or p_movement is null or p_is_competition_lift is null
     or char_length(coalesce(p_muscle_group, '')) > 80 then
    raise exception using errcode = '22023', message = 'Exercise details are invalid.';
  end if;

  if not exists (
    select 1 from public.exercises e
    where e.id = p_exercise_id and e.owner_id is null
  ) then
    raise exception using errcode = '22023', message = 'Only built-in exercises can be customized.';
  end if;

  insert into public.exercises (
    owner_id, base_exercise_id, name, category, movement, muscle_group, is_competition_lift
  ) values (
    coach_id, p_exercise_id, btrim(p_name), p_category, p_movement,
    nullif(btrim(coalesce(p_muscle_group, '')), ''), p_is_competition_lift
  )
  on conflict (owner_id, base_exercise_id)
    where owner_id is not null and base_exercise_id is not null
    do update set
      name = excluded.name,
      category = excluded.category,
      movement = excluded.movement,
      muscle_group = excluded.muscle_group,
      is_competition_lift = excluded.is_competition_lift
  returning id into customized_id;

  update public.program_exercises pe
  set exercise_id = customized_id
  from public.days d
  join public.weeks w on w.id = d.week_id
  where pe.day_id = d.id
    and pe.exercise_id = p_exercise_id
    and public.owns_program(w.program_id, coach_id);

  return customized_id;
end;
$$;

revoke all on function public.customize_builtin_exercise(
  uuid, text, public.exercise_category, public.exercise_movement, text, boolean
) from public, anon;
grant execute on function public.customize_builtin_exercise(
  uuid, text, public.exercise_category, public.exercise_movement, text, boolean
) to authenticated;

revoke all on function public.validate_exercise_base() from public, anon;
