alter table public.profiles
  add column bio text constraint profiles_bio_length check (bio is null or char_length(bio) <= 500),
  add column category text constraint profiles_category_length check (category is null or char_length(category) <= 60),
  add column achievements text constraint profiles_achievements_length check (achievements is null or char_length(achievements) <= 1500),
  add column profile_photo_path text constraint profiles_photo_path_own_folder
    check (profile_photo_path is null or profile_photo_path like (id::text || '/%'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('athlete-profile-photos', 'athlete-profile-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "athletes upload own profile photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'athlete-profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.current_user_has_role('athlete')
  );

create policy "athletes and active coaches read profile photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'athlete-profile-photos'
    and (
      (
        (storage.foldername(name))[1] = (select auth.uid())::text
        and public.current_user_has_role('athlete')
      )
      or exists (
        select 1
        from public.coach_athlete_links link
        where link.athlete_id::text = (storage.foldername(name))[1]
          and link.coach_id = (select auth.uid())
          and link.status = 'active'
          and public.current_user_has_role('coach')
      )
    )
  );

create policy "athletes delete own profile photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'athlete-profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.current_user_has_role('athlete')
  );
