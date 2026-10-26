begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'coach-a@topset.test', '', now(), '{"role":"coach","name":"Coach One"}'),
  ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'coach-b@topset.test', '', now(), '{"role":"coach","name":"Coach Two"}'),
  ('20000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'athlete-a@topset.test', '', now(), '{"role":"athlete","name":"Athlete One","unit":"kg","squat_max":"180","bench_max":"110","deadlift_max":"220"}'),
  ('20000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'athlete-b@topset.test', '', now(), '{"role":"athlete","name":"Athlete Two","unit":"lb"}');

select is((
  select count(*)::integer
  from public.profiles
  where id = '20000000-0000-4000-8000-000000000001'
    and squat_max = 180 and bench_max = 110 and deadlift_max = 220
), 1, 'signup stores athlete lifting maxes');

insert into public.coach_athlete_links (coach_id, athlete_id, status)
values ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'active');
insert into public.programs (id, coach_id, name)
values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Coach One Program'),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Coach Two Program');
insert into public.program_assignments (program_id, coach_id, athlete_id, start_date, sync_mode)
values ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', current_date, 'live');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select is((select count(*)::integer from public.profiles where id = auth.uid()), 1, 'coach reads own profile');
select is((select count(*)::integer from public.profiles where role = 'athlete'), 1, 'coach reads only linked athlete profile');
select is((select count(*)::integer from public.programs), 1, 'coach reads own program');
select is((select count(*)::integer from public.programs where id = '30000000-0000-4000-8000-000000000002'), 0, 'coach cannot read another coach program');

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
select is((select count(*)::integer from public.programs), 1, 'athlete reads assigned program');
select is((select count(*)::integer from public.programs where id = '30000000-0000-4000-8000-000000000002'), 0, 'athlete cannot read another coach program');
select is((select count(*)::integer from public.profiles where role = 'athlete'), 1, 'athlete cannot read another athlete profile');
update public.programs set name = 'Tampered' where id = '30000000-0000-4000-8000-000000000001';
select is((select count(*)::integer from public.programs where id = '30000000-0000-4000-8000-000000000001' and name = 'Coach One Program'), 1, 'athlete cannot update coach prescription');
select throws_ok(
  $$update public.profiles set role = 'coach' where id = auth.uid()$$,
  'P0001',
  'Account identity and role cannot be changed',
  'athlete cannot change own role'
);

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from public.programs), 0, 'unassigned athlete cannot read programs');
select is((select count(*)::integer from public.profiles where role = 'coach'), 0, 'unlinked athlete cannot read coach profiles');

select * from finish();
rollback;
