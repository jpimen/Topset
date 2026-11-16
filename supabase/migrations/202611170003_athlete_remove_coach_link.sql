-- Rollback: revoke and drop public.remove_athlete_coach_link(uuid).
create or replace function public.remove_athlete_coach_link(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.current_user_has_role('athlete') then
    raise exception using errcode = '42501', message = 'athlete_only';
  end if;

  update public.coach_athlete_links
  set status = 'removed', updated_at = clock_timestamp()
  where id = p_link_id and athlete_id = (select auth.uid()) and status = 'active';
  if not found then raise exception using errcode = 'P0002', message = 'link_not_found'; end if;
end;
$$;

revoke all on function public.remove_athlete_coach_link(uuid) from public, anon;
grant execute on function public.remove_athlete_coach_link(uuid) to authenticated;
