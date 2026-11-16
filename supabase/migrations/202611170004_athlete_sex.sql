alter table public.profiles
  add column sex text constraint profiles_sex_valid check (sex is null or sex in ('male', 'female'));
