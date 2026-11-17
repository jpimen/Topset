-- Rollback: first retain only one program row per athlete (export extra plans if needed), then restore the athlete-only primary key and drop program_id.
alter table public.athlete_personal_programs
  add column program_id uuid;

update public.athlete_personal_programs
set program_id = (document ->> 'id')::uuid;

alter table public.athlete_personal_programs
  alter column program_id set not null;

alter table public.athlete_personal_programs
  drop constraint athlete_personal_programs_pkey;

alter table public.athlete_personal_programs
  add constraint athlete_personal_programs_pkey primary key (athlete_id, program_id),
  add constraint athlete_personal_programs_document_id_matches_program_id
    check ((document ->> 'id')::uuid = program_id);
