begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

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
insert into public.blocks (id, program_id, name, position) values
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Block A', 0),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 'Block B', 0);
insert into public.weeks (id, program_id, block_id, week_number, name) values
  ('50000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 1, 'Week 1'),
  ('50000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 1, 'Week 1');
insert into public.days (id, week_id, day_number, name) values
  ('60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 1, 'Day 1'),
  ('60000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002', 1, 'Day 1');
insert into public.program_exercises (id, day_id, exercise_id, position, set_type, sets, reps, rpe, load_mode)
values
  ('70000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', (select id from public.exercises where owner_id is null and name = 'Comp Squat'), 0, 'top', 1, '1', 7, 'rpe'),
  ('70000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000002', (select id from public.exercises where owner_id is null and name = 'Comp Squat'), 0, 'top', 1, '1', 7, 'rpe');
insert into public.athlete_maxes (athlete_id, lift, e1rm, tested_on) values
  ('20000000-0000-4000-8000-000000000001', 'squat', 180, current_date),
  ('20000000-0000-4000-8000-000000000002', 'squat', 170, current_date);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select is((select count(*)::integer from public.profiles where id = auth.uid()), 1, 'coach reads own profile');
select is((select count(*)::integer from public.profiles where role = 'athlete'), 1, 'coach reads only linked athlete profile');
select is((select count(*)::integer from public.programs), 1, 'coach reads own program');
select is((select count(*)::integer from public.programs where id = '30000000-0000-4000-8000-000000000002'), 0, 'coach cannot read another coach program');
select is((select count(*)::integer from public.blocks), 1, 'coach reads own block');
update public.blocks set name = 'Tampered B' where id = '40000000-0000-4000-8000-000000000002';
select is((select count(*)::integer from public.blocks where id = '40000000-0000-4000-8000-000000000002' and name = 'Block B'), 0, 'coach cannot edit another coach block');
select is((select count(*)::integer from public.weeks), 1, 'coach reads own week');
select is((select count(*)::integer from public.days), 1, 'coach reads own day');
select is((select count(*)::integer from public.program_exercises), 1, 'coach reads own program rows');
select is((select count(*)::integer from public.program_exercises where id = '70000000-0000-4000-8000-000000000002'), 0, 'coach cannot read another coach rows');
update public.programs set name = 'Tampered B' where id = '30000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from public.programs where id = '30000000-0000-4000-8000-000000000002' and name = 'Coach Two Program'), 1, 'coach cannot edit another coach program');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
update public.program_exercises set reps = '99' where id = '70000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from public.program_exercises where id = '70000000-0000-4000-8000-000000000002' and reps = '1'), 1, 'coach cannot edit another coach rows');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select ok((select count(*) > 0 from public.exercises where owner_id is null), 'coach reads built-in exercises');
update public.exercises set name = 'Tampered Comp Squat' where owner_id is null and name = 'Comp Squat';
select is((select count(*)::integer from public.exercises where owner_id is null and name = 'Comp Squat'), 1, 'coach cannot edit built-in exercise');
select is((select count(*)::integer from public.athlete_maxes), 1, 'coach reads maxes for active linked athlete');
select is((select count(*)::integer from public.athlete_maxes where athlete_id = '20000000-0000-4000-8000-000000000002'), 0, 'coach cannot read unlinked athlete maxes');
select lives_ok(
  $$select public.save_coach_program_document(
    '30000000-0000-4000-8000-000000000001',
    (select updated_at from public.programs where id = '30000000-0000-4000-8000-000000000001'),
    jsonb_build_object(
      'program', jsonb_build_object('name', 'Atomic save', 'unit', 'kg'),
      'weeks', jsonb_build_array(jsonb_build_object(
        'id', '50000000-0000-4000-8000-000000000001', 'week_number', 1, 'name', 'Week 1',
        'days', jsonb_build_array(jsonb_build_object(
          'id', '60000000-0000-4000-8000-000000000001', 'day_number', 1, 'name', 'Day 1',
          'exercises', jsonb_build_array(jsonb_build_object(
            'id', '70000000-0000-4000-8000-000000000001',
            'exercise_id', (select id from public.exercises where owner_id is null and name = 'Comp Squat'),
            'position', 0, 'set_type', 'top', 'sets', 1, 'reps', '1', 'reps_min', 1,
            'reps_max', 1, 'rpe', 7, 'load_mode', 'rpe'
          ))
        ))
      ))
    )
  )$$,
  'coach saves complete program document atomically'
);
select throws_ok(
  $$select public.save_coach_program_document('30000000-0000-4000-8000-000000000001', '2000-01-01T00:00:00Z', '{"program":{"name":"Stale"},"weeks":[]}'::jsonb)$$,
  '40001',
  'program_conflict',
  'stale program save is rejected as a conflict'
);
select lives_ok(
  $$select public.save_coach_program_document(
    '30000000-0000-4000-8000-000000000001',
    (select updated_at from public.programs where id = '30000000-0000-4000-8000-000000000001'),
    jsonb_build_object(
      'program', jsonb_build_object('name', 'Atomic save', 'unit', 'kg'),
      'weeks', jsonb_build_array(jsonb_build_object(
        'id', '50000000-0000-4000-8000-000000000001', 'week_number', 1, 'name', 'Week 1',
        'days', jsonb_build_array(jsonb_build_object(
          'id', '60000000-0000-4000-8000-000000000001', 'day_number', 1, 'name', 'Day 1',
          'exercises', jsonb_build_array(jsonb_build_object(
            'id', '70000000-0000-4000-8000-000000000001',
            'exercise_id', (select id from public.exercises where owner_id is null and name = 'Comp Squat'),
            'position', 0, 'set_type', null, 'sets', null, 'reps', '', 'rpe', null, 'load_mode', 'none'
          ))
        ))
      ))
    )
  )$$,
  'coach can clear optional grid cells'
);
select is((select count(*)::integer from public.program_exercises where id = '70000000-0000-4000-8000-000000000001' and set_type is null and sets is null and reps = ''), 1, 'cleared grid cells persist');

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
select is((select count(*)::integer from public.programs), 0, 'athlete cannot read builder program');
select is((select count(*)::integer from public.programs where id = '30000000-0000-4000-8000-000000000002'), 0, 'athlete cannot read another coach program');
select is((select count(*)::integer from public.blocks), 0, 'athlete cannot read blocks');
select is((select count(*)::integer from public.weeks), 0, 'athlete cannot read weeks');
select is((select count(*)::integer from public.days), 0, 'athlete cannot read days');
select is((select count(*)::integer from public.program_exercises), 0, 'athlete cannot read program rows');
select is((select count(*)::integer from public.exercises), 0, 'athlete cannot read exercise library');
select is((select count(*)::integer from public.athlete_maxes), 0, 'athlete cannot read phase A maxes');
select is((select count(*)::integer from public.profiles where role = 'athlete'), 1, 'athlete cannot read another athlete profile');
update public.programs set name = 'Tampered' where id = '30000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select is((select count(*)::integer from public.programs where id = '30000000-0000-4000-8000-000000000001' and name = 'Atomic save'), 1, 'athlete cannot update coach prescription');
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$insert into public.blocks (program_id, name) values ('30000000-0000-4000-8000-000000000001', 'Athlete block')$$,
  '42501',
  'new row violates row-level security policy for table "blocks"',
  'athlete cannot write builder tables'
);
select throws_ok(
  $$update public.profiles set role = 'coach' where id = auth.uid()$$,
  'P0001',
  'Account identity and role cannot be changed',
  'athlete cannot change own role'
);

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from public.programs), 0, 'unassigned athlete cannot read programs');
select is((select count(*)::integer from public.profiles where role = 'coach'), 0, 'unlinked athlete cannot read coach profiles');

set local role anon;
select throws_ok($$select count(*) from public.programs$$, '42501', 'permission denied for table programs', 'logged-out users cannot read programs');
select throws_ok($$select count(*) from public.exercises$$, '42501', 'permission denied for table exercises', 'logged-out users cannot read exercise library');

select * from finish();
rollback;
