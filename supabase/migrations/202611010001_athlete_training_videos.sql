-- Rollback: drop public.athlete_training_videos and the athlete-training-videos bucket.
create table public.athlete_training_videos (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles (id) on delete cascade,
  assignment_id uuid not null,
  day_id uuid not null,
  day_name text not null check (char_length(day_name) between 1 and 120),
  label text not null check (label in (
    'Topset', '1st set', '2nd set', '3rd set', '4th set', '5th set', '6th set', '7th set', '8th set', '9th set', '10th set',
    '11th set', '12th set', '13th set', '14th set', '15th set', '16th set', '17th set', '18th set', '19th set', '20th set'
  )),
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 255),
  content_type text not null check (content_type in ('video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v')),
  file_size integer not null check (file_size between 1 and 104857600),
  created_at timestamptz not null default now(),
  constraint athlete_training_videos_assignment_athlete_fkey foreign key (assignment_id, athlete_id)
    references public.program_assignments (id, athlete_id) on delete cascade
);

create index athlete_training_videos_assignment_day_idx on public.athlete_training_videos (assignment_id, day_id, created_at desc);

alter table public.athlete_training_videos enable row level security;
revoke all on public.athlete_training_videos from public, anon, authenticated;
grant select, insert, delete on public.athlete_training_videos to authenticated;

create policy "athletes read own training videos" on public.athlete_training_videos
  for select to authenticated using (
    public.current_user_has_role('athlete') and athlete_id = (select auth.uid())
  );

create policy "athletes post own training videos for assigned days" on public.athlete_training_videos
  for insert to authenticated with check (
    public.current_user_has_role('athlete')
    and athlete_id = (select auth.uid())
    and public.athlete_can_access_workout_day(assignment_id, day_id)
  );

create policy "athletes delete own training videos" on public.athlete_training_videos
  for delete to authenticated using (
    public.current_user_has_role('athlete') and athlete_id = (select auth.uid())
  );

create policy "linked coaches read active assignment training videos" on public.athlete_training_videos
  for select to authenticated using (
    public.current_user_has_role('coach')
    and exists (
      select 1
      from public.program_assignments a
      where a.id = athlete_training_videos.assignment_id
        and a.athlete_id = athlete_training_videos.athlete_id
        and a.coach_id = (select auth.uid())
        and a.status = 'active'
        and a.start_date <= current_date
        and public.is_active_coach_athlete(a.coach_id, a.athlete_id)
        and case
          when a.sync_mode = 'snapshot' then exists (
            select 1
            from jsonb_array_elements(coalesce(a.program_snapshot -> 'weeks', '[]'::jsonb)) w
            cross join lateral jsonb_array_elements(coalesce(w -> 'days', '[]'::jsonb)) d
            where d ->> 'id' = athlete_training_videos.day_id::text
          )
          else exists (
            select 1
            from public.days d
            join public.weeks w on w.id = d.week_id
            where d.id = athlete_training_videos.day_id
              and w.program_id = a.program_id
          )
        end
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('athlete-training-videos', 'athlete-training-videos', false, 104857600, array['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "athletes upload registered training videos" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'athlete-training-videos'
    and public.current_user_has_role('athlete')
    and exists (
      select 1
      from public.athlete_training_videos v
      where v.storage_path = name
        and v.athlete_id = (select auth.uid())
        and public.athlete_can_access_workout_day(v.assignment_id, v.day_id)
    )
  );

create policy "athletes and linked coaches read training videos" on storage.objects
  for select to authenticated using (
    bucket_id = 'athlete-training-videos'
    and exists (
      select 1 from public.athlete_training_videos v
      where v.storage_path = name
    )
  );

create policy "athletes delete own training videos" on storage.objects
  for delete to authenticated using (
    bucket_id = 'athlete-training-videos'
    and public.current_user_has_role('athlete')
    and exists (
      select 1 from public.athlete_training_videos v
      where v.storage_path = name
        and v.athlete_id = (select auth.uid())
    )
  );

comment on table public.athlete_training_videos is 'Private athlete training videos with labels, readable by the athlete and their currently linked coach for active assigned days.';
