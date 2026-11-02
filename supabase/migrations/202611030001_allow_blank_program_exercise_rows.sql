-- Rollback: alter public.program_exercises.exercise_id set not null;
-- ensure every row has an exercise before applying the rollback.
alter table public.program_exercises
  alter column exercise_id drop not null;

comment on column public.program_exercises.exercise_id is
  'Nullable while a Coach is drafting an unassigned exercise row; Athlete snapshots omit rows without an exercise.';
