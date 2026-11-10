-- Rollback: restore the 100 MB constraint and bucket limit after deleting any larger files.
alter table public.athlete_training_videos
  drop constraint athlete_training_videos_file_size_check,
  alter column file_size type bigint;

alter table public.athlete_training_videos
  add constraint athlete_training_videos_file_size_check
  check (file_size between 1 and 50000000000);

update storage.buckets
set file_size_limit = 50000000000
where id = 'athlete-training-videos';
