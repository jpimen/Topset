-- Rollback: alter publication supabase_realtime drop table public.profiles;
alter publication supabase_realtime add table public.profiles;
