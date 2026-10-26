PROJECT TITLE: Topset

OVERVIEW
Build "Topset", a powerlifting program builder web app with two account types: Coach (admin) and Athlete. Coaches manually build multi-week programs in a clean spreadsheet-style grid, backed by built-in calculators and science-based strength peaking. Athletes see the program their coach assigned, log their training, and track progress. The two roles get completely different interfaces. Topset replaces a Google Sheets workflow with a faster, more polished, mobile-friendly experience.

REFERENCE LAYOUT (replicate the logic, improve the design)
The current spreadsheet is organized as:
- Week header (e.g. "Week 4"), containing Day 1, Day 2, Day 3, ...
- Each day is a table with columns: Exercise | Sets | Reps | RPE | Load | Load Lifted | RPE Lifted | Coach Notes | Athlete Notes
- RPE is a colored dropdown chip (RPE 5 yellow, RPE 6 green, RPE 7 blue-grey, RPE 7.5+, etc.)
- Load can be a single value (117.5) or a range (130-132.5)
- Reps can be numeric or timed (e.g. "1min" for planks)
- A typical day: top set (1x1 @ RPE 7) -> back-off sets (3x3 @ RPE 6) -> accessories (no RPE/load)
- Coach columns (prescription) are separate from athlete columns (Load Lifted, RPE Lifted, Athlete Notes)

USER ROLES AND ACCOUNTS

1. COACH (admin)
- Creates and owns programs; builds, edits, duplicates, and assigns them
- Manages a roster of athletes
- Sees every linked athlete's logs, compliance, and analytics
- Uses the full desktop-first builder, calculators, and peaking module

2. ATHLETE
- Views the program assigned to them (read-only on the prescription)
- Logs Load Lifted, RPE Lifted, and Athlete Notes
- Sees their own progress, PRs, and meet countdown
- Cannot edit the coach's prescription, other athletes' data, or the builder

AUTH AND LOGIN SCREEN
- Single login screen: email + password, plus optional Google sign-in
- "Create account" flow begins with a role selector: two large cards, "I'm a Coach" and "I'm an Athlete"
- Sign-up fields:
  - Coach: name, email, password, optional team/gym name
  - Athlete: name, email, password, bodyweight, weight class, unit (kg/lb), current squat/bench/deadlift maxes (optional), optional coach invite code
- After login, redirect by role: coaches go to /coach, athletes go to /athlete
- Route guards: an athlete must never reach coach routes, enforced in the frontend and by database Row Level Security
- Role is set at signup and cannot be changed by the user afterward

COACH-ATHLETE LINKING
- Each coach gets a unique invite code and shareable invite link
- Athlete signs up with the code (or enters it later in settings) to connect to that coach
- Coach can also invite by email, approve or decline join requests, and remove athletes
- Athletes without a coach get "Solo mode": basic template viewing, workout logging, and calculators, but no coach builder
- One athlete has one active coach at a time; one coach can have many athletes
- Coach assigns a program to one or many athletes with a start date; the coach chooses whether later edits sync to athletes or the assignment stays a snapshot

CORE FEATURES

1. Program Builder (Coach only)
- Hierarchy: Program -> Mesocycle/Block -> Week -> Day -> Exercise rows
- Inline editable grid with keyboard navigation (Tab/Enter/arrows), like a spreadsheet
- Drag-and-drop to reorder exercises and days
- Duplicate day, duplicate week, and "copy week N to N+1 with progression" (auto-add % or RPE)
- Exercise library with competition lifts (Comp Squat, Comp Bench, Comp Deadlift), variations (Spoto Press, Pause Squat, Deficit Deadlift, etc.), and accessories; custom exercises with tags (muscle group, movement pattern, main/variation/accessory)
- Set types: top set, back-off set, working set, warm-up, AMRAP
- Load input modes: absolute kg/lb, %1RM, RPE-derived (auto-calculated), or range
- Supersets and notes per exercise
- Templates: save any week or day as a reusable template

2. Calculation Engine
- e1RM calculator (Epley, Brzycki, and RPE-based), selectable
- RPE <-> %1RM chart (Tuchscherer-style) that auto-suggests load from reps + RPE + e1RM
- Load rounding to available plates (default 2.5 kg increments; kg/lb toggle)
- Plate calculator (bar weight, collars, available plates) with a visual barbell loading diagram
- Volume metrics per day/week: total sets, reps, tonnage, hard sets per lift, average intensity (%), INOL
- Strength score calculators: DOTS, Wilks, IPF GL points
- Warm-up set generator for any top set
- All calculations are pure, unit-tested TypeScript functions in /lib/engine (e1rm, rpeTable, taper, banister, dots, wilks, plates)

3. Science-Based Peaking Module (Coach only; results visible to athlete)
- Input: meet date, current training maxes or e1RMs, bodyweight, experience level, days per week
- Auto-generate a peaking plan counting backward from the meet date:
  - Accumulation -> Intensification -> Realization -> Taper phases
  - Choose model: Linear, Block, DUP (Daily Undulating), or Conjugate-lite
  - Volume tapers 30-50% over the final 7-14 days while intensity is maintained; the last heavy single of each lift lands about 7-10 days out
  - Fatigue management using the Banister fitness-fatigue model, showing a projected "readiness/form" curve peaking on meet day
  - Weekly fatigue/volume load chart and projected e1RM trend line
- Meet-day attempt selector: suggest opener (about 90-93% of projected max), second (about 96-98%), third (about 100-103%); editable; shows projected total and points
- Everything generated is fully editable in the manual grid afterward
- A short "why" tooltip on each auto-generated decision, so it's educational rather than a black box

4. Logging and Autoregulation (Athlete logs, Coach reviews)
- Athlete fills in Load Lifted, RPE Lifted, and Athlete Notes per set
- Coach sees compliance and planned vs. actual comparison, and can comment on any log
- Auto-compute actual e1RM from logged sets; if RPE runs consistently higher or lower than planned, suggest load adjustments for upcoming weeks (coach accepts or rejects with one tap)
- Rest timer and "next set" focus mode for use in the gym

5. Progress and Analytics
- Athlete: e1RM per lift over time, PRs, volume trends, bodyweight log, meet countdown, projected peak chart
- Coach: roster-wide analytics, per-athlete deep dive, RPE accuracy, planned vs. actual intensity per week
- Export program to PDF, CSV, and Google Sheets-compatible format

COACH UI (desktop-first, dense, powerful)
- Left sidebar: Dashboard, Athletes, Programs, Exercise Library, Templates, Analytics, Settings
- Dashboard: athlete roster cards showing current week, compliance %, last session, upcoming meet, and flags (missed sessions, RPE running high, a PR just hit)
- Program builder: the full editable grid
- Athlete detail page: assigned program, logs, e1RM trends, planned vs. actual, and a notes thread
- Quick actions: assign program, duplicate for another athlete, adjust upcoming week from logged data
- Coach notes per set and per session

ATHLETE UI (mobile-first, simple, focused)
- Bottom tab bar: Today, Program, Progress, Profile
- Today: the current day's workout as a vertical list of exercise cards with large tap targets and one set in focus at a time; shows prescribed sets x reps @ RPE and the load, with plates per side; inputs for Load Lifted and RPE Lifted; rest timer; finish-session button
- Program: read-only week/day overview with a week timeline; the coach's notes are visible
- Progress: e1RM per lift, PRs, volume, meet countdown, projected peak chart
- Profile: bodyweight log, maxes, unit and plate settings, coach info
- No editing grid and no builder controls; it should feel like a clean workout app, not a spreadsheet
- Offline-friendly: logs queue and sync when the connection returns

PERMISSIONS (enforce with Postgres RLS)
- Coach: full CRUD on programs they own; read access to logs of linked athletes; can comment on logs
- Athlete: read their assigned program; insert and update only their own logged_sets, bodyweight entries, and athlete notes; read-only on prescription fields
- Nobody can read another coach's or another athlete's data

UI/UX REQUIREMENTS (must be a clear upgrade over a spreadsheet)
- Modern dark-first design with a light mode option; deep green accent (like the reference sheet) and clear semantic RPE colors (5 yellow, 6 green, 7 blue, 8 orange, 9 red-orange, 10 red)
- Spreadsheet speed with app polish on the coach side: sticky headers, compact density toggle, zebra rows, clear day dividers (replace the harsh red/black bars)
- Collapsible days and weeks; week tabs or a horizontal week timeline
- RPE as an elegant inline chip selector with quick keyboard entry
- Coach vs. athlete column groups visually separated and toggleable in the coach builder
- Live-calculated tooltips (hover load -> %1RM, estimated RPE, plates per side)
- Undo/redo, autosave, and helpful empty states
- Accessible (keyboard nav, contrast, ARIA) and fast (optimistic updates)
- Onboarding wizard per role: athlete sets lifts, maxes, unit, plates; coach sets team name, then chooses "Build manually" or "Generate peaking plan"

SUGGESTED TECH STACK (adjust if you recommend better)
- Frontend: React + TypeScript + Tailwind + shadcn/ui, TanStack Table (editable grid), dnd-kit, Recharts
- State: Zustand or TanStack Query
- Backend: Supabase (Postgres + Auth + Row Level Security); optional Edge Functions for the calculation engine
- Separate route trees and layouts for /coach and /athlete

DATA MODEL (starting point)
profiles (id, role: 'coach' | 'athlete', name, unit, bodyweight, weight_class, team_name)
coach_athlete_links (coach_id, athlete_id, status: pending/active/removed, invite_code)
programs, blocks, weeks, days
exercises (library)
program_exercises (sets, reps, rpe, load_type, load_value, load_min, load_max, set_type, notes_coach)
program_assignments (program_id, athlete_id, start_date, sync_mode)
logged_sets (load_lifted, rpe_lifted, notes_athlete)
comments (log_id, author_id, text)
maxes (lift, e1rm, date)
meets (date, attempts)

BUILD ORDER
1. Scaffold, DB schema with roles, auth, role-based routing, and RLS policies
2. Calculation engine with unit tests
3. Coach UI: program builder grid (MVP) and athlete roster
4. Coach-athlete linking and program assignment
5. Athlete UI: Today view, logging, and Program view
6. Peaking module (coach side) with athlete-facing results
7. Analytics and export

Start with steps 1 and 2. Show me the role-based login and signup flow before building the rest, and ask before moving on to each later step.