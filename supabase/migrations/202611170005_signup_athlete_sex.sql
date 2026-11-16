-- Rollback: restore the prior create_profile_for_new_user() body without sex handling.
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
  chosen_sex text := nullif(btrim(new.raw_user_meta_data ->> 'sex'), '');
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

  if chosen_role = 'athlete' and chosen_sex is not null and chosen_sex not in ('male', 'female') then
    raise exception 'Sex must be male or female';
  end if;

  insert into public.profiles (id, role, name, team_name, unit, bodyweight, weight_class, sex)
  values (
    new.id,
    chosen_role,
    chosen_name,
    case when chosen_role = 'coach' then nullif(btrim(new.raw_user_meta_data ->> 'team_name'), '') else null end,
    case when chosen_role = 'athlete' and new.raw_user_meta_data ->> 'unit' in ('kg', 'lb') then new.raw_user_meta_data ->> 'unit' else null end,
    case when chosen_role = 'athlete' then chosen_weight else null end,
    case when chosen_role = 'athlete' then nullif(btrim(new.raw_user_meta_data ->> 'weight_class'), '') else null end,
    case when chosen_role = 'athlete' then chosen_sex else null end
  );
  return new;
end;
$$;
