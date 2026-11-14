-- Rollback: alter publication supabase_realtime drop table public.program_assignments;
--           drop trigger sync_active_snapshot_layout on public.programs;
--           drop function public.sync_active_snapshot_layout();
create or replace function public.sync_active_snapshot_layout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.layout is not distinct from old.layout then
    return new;
  end if;

  update public.program_assignments a
  set program_snapshot = jsonb_set(a.program_snapshot, '{layout}', new.layout, true)
  where a.program_id = new.id
    and a.sync_mode = 'snapshot'
    and a.status = 'active'
    and a.program_snapshot->'layout' is distinct from new.layout;

  return new;
end;
$$;

revoke all on function public.sync_active_snapshot_layout() from public, anon, authenticated;

create trigger sync_active_snapshot_layout
  after update of layout on public.programs
  for each row execute function public.sync_active_snapshot_layout();

alter publication supabase_realtime add table public.program_assignments;
