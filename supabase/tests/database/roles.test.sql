begin;
create extension if not exists pgtap with schema extensions;
select plan(109);

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
select lives_ok($$select public.save_athlete_workout_session(
  '80000000-0000-4000-8000-000000000001',
  (select id from public.program_assignments where athlete_id = auth.uid() and status = 'active'),
  '60000000-0000-4000-8000-000000000001', current_date, false,
  '[{"program_exercise_id":"70000000-0000-4000-8000-000000000001","set_number":1,"load_lifted":150,"rpe_lifted":8,"notes_athlete":"Felt smooth"}]'::jsonb
)$$, 'athlete can save a set for their assigned live workout');
select is((select count(*)::integer from public.workout_sessions where id = '80000000-0000-4000-8000-000000000001'), 1, 'athlete can read own workout session');
select is((select count(*)::integer from public.logged_sets where session_id = '80000000-0000-4000-8000-000000000001'), 1, 'athlete can read own logged set');
select is((select load_lifted || ':' || rpe_lifted || ':' || notes_athlete from public.logged_sets where session_id = '80000000-0000-4000-8000-000000000001'), '150.00:8.0:Felt smooth', 'athlete log values persist');
select lives_ok($$select public.save_athlete_workout_session(
  '80000000-0000-4000-8000-000000000001',
  (select id from public.program_assignments where athlete_id = auth.uid() and status = 'active'),
  '60000000-0000-4000-8000-000000000001', current_date, false,
  '[{"program_exercise_id":"70000000-0000-4000-8000-000000000001","set_number":1,"load_lifted":152.5,"rpe_lifted":8.5,"notes_athlete":"Updated"}]'::jsonb
)$$, 'replaying an offline save updates the same session');
select is((select count(*)::integer from public.logged_sets where session_id = '80000000-0000-4000-8000-000000000001'), 1, 'replaying a save does not duplicate logged sets');
select throws_ok($$select public.save_athlete_workout_session(
  '80000000-0000-4000-8000-000000000002',
  (select id from public.program_assignments where athlete_id = auth.uid() and status = 'active'),
  '60000000-0000-4000-8000-000000000001', current_date, false,
  '[{"program_exercise_id":"70000000-0000-4000-8000-000000000002","set_number":1,"load_lifted":150}]'::jsonb
)$$, '42501', 'workout_exercise_not_assigned', 'athlete cannot log an exercise outside their assignment');
select is((select count(*)::integer from public.programs), 1, 'athlete can read a live assigned program');
select is((select count(*)::integer from public.program_exercises where id = '70000000-0000-4000-8000-000000000001' and set_type is null and sets is null and reps = ''), 1, 'live athlete reads the latest successfully saved program document');
select lives_ok($$insert into public.athlete_daily_checkins (athlete_id, checkin_date, bodyweight, bodyweight_unit, sleep_quality, sleep_hours, protein_grams, calories_kcal, carbs_grams, fatigue_level)
  values (auth.uid(), current_date, 82.5, 'kg', 4, 7.5, 180, 2600, 320, 3)$$, 'athlete can insert own daily check-in');
select is((select count(*)::integer from public.athlete_daily_checkins where athlete_id = auth.uid() and checkin_date = current_date), 1, 'athlete can read own daily check-in');
select is((select bodyweight || ':' || sleep_quality || ':' || sleep_hours || ':' || protein_grams || ':' || calories_kcal || ':' || carbs_grams || ':' || fatigue_level from public.athlete_daily_checkins where athlete_id = auth.uid() and checkin_date = current_date), '82.50:4:7.5:180.0:2600:320.0:3', 'daily check-in values persist');
select lives_ok($$insert into public.athlete_daily_checkins (athlete_id, checkin_date, bodyweight, bodyweight_unit, sleep_quality, sleep_hours, protein_grams, calories_kcal, carbs_grams, fatigue_level)
  values (auth.uid(), current_date, 83, 'kg', 4, 8, 190, 2700, 350, 2)
  on conflict (athlete_id, checkin_date) do update set bodyweight = excluded.bodyweight, sleep_hours = excluded.sleep_hours$$, 'athlete can update a same-day check-in');
select is((select count(*)::integer from public.athlete_daily_checkins where athlete_id = auth.uid() and checkin_date = current_date), 1, 'same-day check-in updates without duplicating records');
select is((select bodyweight || ':' || sleep_hours from public.athlete_daily_checkins where athlete_id = auth.uid() and checkin_date = current_date), '83.00:8.0', 'updated check-in values are returned');
select lives_ok($$insert into public.athlete_workout_checkins (athlete_id, assignment_id, day_id, bodyweight, bodyweight_unit, sleep_quality, sleep_hours, protein_grams, calories_kcal, carbs_grams, fatigue_level)
  values (auth.uid(), (select id from public.program_assignments where athlete_id = auth.uid() and status = 'active'), '60000000-0000-4000-8000-000000000001', 82.5, 'kg', 4, 7.5, 180, 2600, 320, 3)$$, 'athlete can save check-in for own accessible training day');
select is((select count(*)::integer from public.athlete_workout_checkins where athlete_id = auth.uid() and day_id = '60000000-0000-4000-8000-000000000001'), 1, 'athlete can read own training-day check-in');
select is((select bodyweight || ':' || sleep_quality || ':' || sleep_hours || ':' || protein_grams || ':' || calories_kcal || ':' || carbs_grams || ':' || fatigue_level from public.athlete_workout_checkins where athlete_id = auth.uid()), '82.50:4:7.5:180.0:2600:320.0:3', 'training-day check-in values persist');
select lives_ok($$insert into public.athlete_workout_checkins (athlete_id, assignment_id, day_id, bodyweight, bodyweight_unit, sleep_hours)
  values (auth.uid(), (select id from public.program_assignments where athlete_id = auth.uid() and status = 'active'), '60000000-0000-4000-8000-000000000001', 83, 'kg', 8)
  on conflict (assignment_id, day_id) do update set bodyweight = excluded.bodyweight, sleep_hours = excluded.sleep_hours$$, 'athlete can update training-day check-in');
select is((select count(*)::integer from public.athlete_workout_checkins where athlete_id = auth.uid()), 1, 'repeated training-day save does not duplicate check-in');
select is((select bodyweight || ':' || sleep_hours from public.athlete_workout_checkins where athlete_id = auth.uid()), '83.00:8.0', 'updated training-day check-in values persist');
select throws_ok($$insert into public.athlete_workout_checkins (athlete_id, assignment_id, day_id, bodyweight, bodyweight_unit)
  values (auth.uid(), (select id from public.program_assignments where athlete_id = auth.uid() and status = 'active'), '60000000-0000-4000-8000-000000000002', 70, 'kg')$$, '42501', 'new row violates row-level security policy for table "athlete_workout_checkins"', 'athlete cannot write check-in for unrelated program day');
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from public.athlete_workout_checkins), 0, 'athlete cannot read another athlete training-day check-in');
select is((select count(*)::integer from public.athlete_daily_checkins where athlete_id = '20000000-0000-4000-8000-000000000001'), 0, 'athlete cannot read another athlete check-in');
select throws_ok($$insert into public.athlete_daily_checkins (athlete_id, checkin_date, bodyweight, bodyweight_unit) values ('20000000-0000-4000-8000-000000000001', current_date, 70, 'kg')$$, '42501', 'new row violates row-level security policy for table "athlete_daily_checkins"', 'athlete cannot insert another athlete check-in');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select is((select count(*)::integer from public.athlete_daily_checkins where athlete_id = '20000000-0000-4000-8000-000000000001'), 0, 'linked coach cannot read athlete private check-ins');
select is((select count(*)::integer from public.athlete_workout_checkins), 1, 'linked coach can read athlete workout-day check-ins');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from public.athlete_daily_checkins), 0, 'unrelated coach cannot read athlete private check-ins');
select is((select count(*)::integer from public.athlete_workout_checkins), 0, 'unrelated coach cannot read athlete workout-day check-ins');
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
select is((select count(*)::integer from public.programs where id = '30000000-0000-4000-8000-000000000002'), 0, 'athlete cannot read another coach program');
select is((select count(*)::integer from public.blocks), 1, 'athlete can read blocks in live assignment');
select is((select count(*)::integer from public.weeks), 1, 'athlete can read weeks in live assignment');
select is((select count(*)::integer from public.days), 1, 'athlete can read days in live assignment');
select is((select count(*)::integer from public.program_exercises), 1, 'athlete can read prescription rows in live assignment');
select is((select count(*)::integer from public.exercises), 1, 'athlete can read exercises used in live assignment');
select is((select count(*)::integer from public.athlete_maxes), 0, 'athlete cannot read phase A maxes');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select is((select count(*)::integer from public.workout_sessions where id = '80000000-0000-4000-8000-000000000001'), 1, 'linked coach can read athlete workout sessions');
select is((select count(*)::integer from public.logged_sets where session_id = '80000000-0000-4000-8000-000000000001'), 1, 'linked coach can read athlete logged sets');
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
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
select is((select count(*)::integer from public.workout_sessions), 0, 'unassigned athlete cannot read another athlete workout logs');
select is((select count(*)::integer from public.profiles where role = 'coach'), 0, 'unlinked athlete cannot read coach profiles');

set local role anon;
select throws_ok($$select count(*) from public.programs$$, '42501', 'permission denied for table programs', 'logged-out users cannot read programs');
select throws_ok($$select count(*) from public.exercises$$, '42501', 'permission denied for table exercises', 'logged-out users cannot read exercise library');
select throws_ok($$select count(*) from public.workout_sessions$$, '42501', 'permission denied for table workout_sessions', 'logged-out users cannot read workout sessions');
select throws_ok($$select count(*) from public.logged_sets$$, '42501', 'permission denied for table logged_sets', 'logged-out users cannot read athlete logs');
select throws_ok($$select count(*) from public.athlete_daily_checkins$$, '42501', 'permission denied for table athlete_daily_checkins', 'logged-out users cannot read daily check-ins');
select throws_ok($$insert into public.athlete_daily_checkins (athlete_id, checkin_date, bodyweight, bodyweight_unit) values ('20000000-0000-4000-8000-000000000001', current_date, 80, 'kg')$$, '42501', 'permission denied for table athlete_daily_checkins', 'logged-out users cannot write daily check-ins');
select throws_ok($$select count(*) from public.athlete_workout_checkins$$, '42501', 'permission denied for table athlete_workout_checkins', 'logged-out users cannot read workout-day check-ins');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select public.make_coach_invite_code() as coach_two_invite_code \gset
select ok(:'coach_two_invite_code' ~ '^[a-f0-9]{48}$', 'coach invite code is high entropy hex');
select is(public.is_coach_invite_code_valid(:'coach_two_invite_code'), true, 'generated invite code validates');
select is(public.is_coach_invite_code_valid(repeat('0', 48)), false, 'unknown invite code is not valid');

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select lives_ok(format('select public.request_coach_link(%L)', :'coach_two_invite_code'), 'athlete can request a coach link');
select is((select count(*)::integer from public.coach_athlete_links where coach_id = '10000000-0000-4000-8000-000000000002' and athlete_id = auth.uid() and status = 'pending'), 1, 'invite request starts pending');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from public.profiles where id = '20000000-0000-4000-8000-000000000002'), 1, 'coach can see athlete who requested a link');
select lives_ok(format('select public.respond_to_coach_link(%L, true)', (select id from public.coach_athlete_links where coach_id = auth.uid() and athlete_id = '20000000-0000-4000-8000-000000000002')), 'coach can approve own request');
select is((select count(*)::integer from public.coach_athlete_links where coach_id = auth.uid() and athlete_id = '20000000-0000-4000-8000-000000000002' and status = 'active'), 1, 'approval activates link');

select lives_ok($$select * from public.assign_program_to_athletes(
  '30000000-0000-4000-8000-000000000002', array['20000000-0000-4000-8000-000000000002'::uuid], current_date, 'snapshot'
)$$, 'coach can create snapshot assignment for linked athlete');
select is((select program_snapshot #>> '{program,name}' from public.program_assignments where coach_id = auth.uid() and athlete_id = '20000000-0000-4000-8000-000000000002' and status = 'active'), 'Coach Two Program', 'snapshot stores assigned program contents');
update public.programs set name = 'Updated source program' where id = '30000000-0000-4000-8000-000000000002';
select is((select program_snapshot #>> '{program,name}' from public.program_assignments where coach_id = auth.uid() and athlete_id = '20000000-0000-4000-8000-000000000002' and status = 'active'), 'Coach Two Program', 'snapshot remains unchanged after source edit');
select throws_ok($$update public.program_assignments set program_snapshot = '{}'::jsonb where athlete_id = '20000000-0000-4000-8000-000000000002'$$, '42501', 'permission denied for table program_assignments', 'coach cannot directly edit immutable assignment snapshot');

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select lives_ok($$select public.save_athlete_workout_session(
  '80000000-0000-4000-8000-000000000003',
  (select id from public.program_assignments where athlete_id = auth.uid() and status = 'active'),
  '60000000-0000-4000-8000-000000000002', current_date, true,
  '[{"program_exercise_id":"70000000-0000-4000-8000-000000000002","set_number":1,"load_lifted":140,"rpe_lifted":7.5}]'::jsonb
)$$, 'athlete can log an exercise from an assigned snapshot');
select is((select count(*)::integer from public.logged_sets where session_id = '80000000-0000-4000-8000-000000000003'), 1, 'athlete can read their snapshot workout log');
select lives_ok($$insert into public.athlete_workout_checkins (athlete_id, assignment_id, day_id, sleep_quality, sleep_hours)
  values (auth.uid(), (select id from public.program_assignments where athlete_id = auth.uid() and status = 'active'), '60000000-0000-4000-8000-000000000002', 5, 8)$$, 'athlete can save check-in for a snapshot assignment day');
select is((select count(*)::integer from public.workout_sessions where id = '80000000-0000-4000-8000-000000000001'), 0, 'athlete cannot read another athlete workout session');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from public.workout_sessions where id = '80000000-0000-4000-8000-000000000001'), 0, 'unrelated coach cannot read another coach athlete logs');
select is((select count(*)::integer from public.workout_sessions where id = '80000000-0000-4000-8000-000000000003'), 1, 'linked coach can read snapshot athlete logs');
select is((select count(*)::integer from public.athlete_workout_checkins where athlete_id = '20000000-0000-4000-8000-000000000002'), 1, 'linked coach can read check-in from snapshot assignment');
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from public.program_assignments where status = 'active' and sync_mode = 'snapshot' and program_snapshot #>> '{program,name}' = 'Coach Two Program'), 1, 'athlete can read own active assignment snapshot');
select is((select count(*)::integer from public.programs where id = '30000000-0000-4000-8000-000000000002'), 0, 'snapshot assignment does not expose mutable source program');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select lives_ok($$select * from public.assign_program_to_athletes(
  '30000000-0000-4000-8000-000000000002', array['20000000-0000-4000-8000-000000000002'::uuid], current_date + 7, 'live'
)$$, 'coach can schedule a future live assignment');
select is((select count(*)::integer from public.program_assignments where athlete_id = '20000000-0000-4000-8000-000000000002' and status = 'ended' and sync_mode = 'snapshot'), 1, 'reassignment ends the previous assignment');
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from public.program_assignments where athlete_id = auth.uid()), 0, 'athlete cannot read an assignment before its start date');
select is((select count(*)::integer from public.exercises), 0, 'future assignment does not expose its live program exercises');
select is((select count(*)::integer from public.workout_sessions where id = '80000000-0000-4000-8000-000000000003'), 0, 'future assignment does not expose prior workout logs');
select is((select count(*)::integer from public.programs where id = '30000000-0000-4000-8000-000000000002'), 0, 'future live assignment does not expose its program early');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select is((select count(*)::integer from public.program_assignments where athlete_id = '20000000-0000-4000-8000-000000000002'), 0, 'unrelated coach cannot read another coach assignment');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select lives_ok(format('select public.remove_coach_athlete_link(%L)', (select id from public.coach_athlete_links where coach_id = auth.uid() and athlete_id = '20000000-0000-4000-8000-000000000001')), 'coach can remove athlete with a workout-day check-in');
select is((select count(*)::integer from public.athlete_workout_checkins), 0, 'removing athlete link revokes coach check-in access');
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
select is((select count(*)::integer from public.athlete_workout_checkins), 0, 'removing coach link revokes access to workout-day check-ins');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select lives_ok(format('select public.remove_coach_athlete_link(%L)', (select id from public.coach_athlete_links where coach_id = auth.uid() and athlete_id = '20000000-0000-4000-8000-000000000002')), 'coach can remove own active athlete');
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from public.program_assignments where athlete_id = auth.uid()), 0, 'removing coach link revokes assignment access');
select is((select count(*)::integer from public.workout_sessions where id = '80000000-0000-4000-8000-000000000003'), 0, 'removing coach link revokes athlete workout log access');

reset role;
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
values (
  '20000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'athlete-c@topset.test', '', now(),
  jsonb_build_object('role', 'athlete', 'name', 'Athlete Three', 'invite_code', :'coach_two_invite_code')
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000003', true);
select is((select count(*)::integer from public.profiles where id = auth.uid() and role = 'athlete'), 1, 'signup with invite creates athlete profile');
select is((select count(*)::integer from public.coach_athlete_links where athlete_id = auth.uid() and coach_id = '10000000-0000-4000-8000-000000000002' and status = 'pending'), 1, 'signup invite creates pending coach request');

select * from finish();
rollback;
