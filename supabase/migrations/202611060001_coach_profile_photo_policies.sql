create policy "coaches upload own profile photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'athlete-profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.current_user_has_role('coach')
  );

create policy "coaches read own profile photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'athlete-profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.current_user_has_role('coach')
  );

create policy "coaches delete own profile photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'athlete-profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.current_user_has_role('coach')
  );
