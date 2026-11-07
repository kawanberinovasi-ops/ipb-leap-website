-- The general GROW workspace continues to hide drafts from other roles.
create function erp_private.pengurus_grow_draft(p_cohort uuid, p_mentee uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  draft jsonb;
begin
  if not erp_private.session_valid()
    or not erp_private.has_role('program')
    or not exists (
      select 1 from public.erp_cohort_staff s
      where s.cohort_id = p_cohort and s.user_id = auth.uid() and s.can_manage
    )
  then
    raise exception 'Draf GROW hanya tersedia untuk Pengurus batch yang ditugaskan.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'data', w.state #> '{canvas,data}',
    'savedAt', w.state #>> '{canvas,at}'
  ) into draft
  from erp_private.grow_workspaces w
  join public.erp_enrolments e on e.cohort_id = w.cohort_id and e.user_id = w.mentee_id
  join public.erp_profiles p on p.id = e.user_id
  where w.cohort_id = p_cohort and w.mentee_id = p_mentee
    and e.role = 'mentee' and e.active and p.active
    and w.state #>> '{canvas,status}' = 'Draft';

  return draft;
end
$$;

create function public.erp_pengurus_grow_draft(p_cohort uuid, p_mentee uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select erp_private.pengurus_grow_draft(p_cohort, p_mentee) $$;

revoke all on function erp_private.pengurus_grow_draft(uuid, uuid), public.erp_pengurus_grow_draft(uuid, uuid)
from public, anon, authenticated;
grant execute on function erp_private.pengurus_grow_draft(uuid, uuid), public.erp_pengurus_grow_draft(uuid, uuid)
to authenticated;
