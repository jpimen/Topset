-- Set type values are coach-defined text labels; preserve existing enum values.
alter table public.program_exercises
  alter column set_type drop default;

alter table public.program_exercises
  alter column set_type type text using set_type::text,
  alter column set_type set default 'working';

alter table public.program_exercises
  add constraint program_exercises_set_type_length_check
  check (set_type is null or (length(btrim(set_type)) between 1 and 40));

-- The save RPC used to cast the JSON value to the closed enum. Keep its checked,
-- transactional save behavior while accepting coach-defined labels.
do $$
declare
  function_definition text;
begin
  select pg_get_functiondef('public.save_coach_program_document(uuid, timestamptz, jsonb)'::regprocedure)
    into function_definition;
  function_definition := replace(function_definition, '::public.program_set_type', '::text');
  execute function_definition;
end;
$$;
