-- Load only the identity/assignment context needed by GROW, mentoring and LMC.
-- Keep the existing subject authorization and draft/publication RPCs unchanged.
begin;
create function erp_private.grow_context(p_cohort uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
 me uuid:=auth.uid(); cohorts jsonb; selected uuid; group_ids uuid[]; members jsonb; subjects uuid[];
begin
 if not erp_private.session_valid() or not exists(select 1 from public.erp_profiles p where p.id=me and p.active) then
  raise exception 'Sesi akun belum terverifikasi. Masuk kembali.' using errcode='42501';
 end if;
 select coalesce(jsonb_agg(to_jsonb(c) order by c.starts_on desc,c.id),'[]'::jsonb)
 into cohorts from public.erp_cohorts c where erp_private.can_cohort(c.id);
 if p_cohort is not null then
  if not exists(select 1 from jsonb_array_elements(cohorts) c where c->>'id'=p_cohort::text) then
   raise exception 'Cohort tidak dapat diakses.' using errcode='42501';
  end if;
  selected:=p_cohort;
 else selected:=(cohorts->0->>'id')::uuid;
 end if;
 select coalesce(array_agg(g.id),'{}'::uuid[]) into group_ids
 from public.erp_groups g where g.cohort_id=selected and g.archived_at is null and erp_private.can_group(g.id);
 select coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb),coalesce(array_agg(distinct m.user_id),'{}'::uuid[])
 into members,subjects from public.erp_group_members m
 join public.erp_profiles p on p.id=m.user_id and p.active
 where m.group_id=any(group_ids) and m.active
 and erp_private.can_subject(selected,m.user_id);
 subjects:=array_append(subjects,me);
 return jsonb_build_object(
  'selectedCohort',selected,'cohorts',cohorts,
  'groups',coalesce((select jsonb_agg(to_jsonb(g) order by g.name,g.id) from public.erp_groups g where g.id=any(group_ids)),'[]'::jsonb),
  'members',members,
  'profiles',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'display_name',p.display_name) order by p.display_name,p.id) from public.erp_profiles p where p.id=any(subjects)),'[]'::jsonb),
  'enrolments',coalesce((select jsonb_agg(to_jsonb(e)) from public.erp_enrolments e where e.cohort_id=selected and e.active
    and ((e.user_id=me) or (e.role='mentee' and e.user_id=any(subjects)))),'[]'::jsonb)
 );
end $$;
create function public.erp_grow_context(p_cohort uuid default null) returns jsonb
language sql stable security invoker set search_path='' as $$select erp_private.grow_context(p_cohort)$$;
revoke all on function erp_private.grow_context(uuid),public.erp_grow_context(uuid) from public,anon,authenticated;
grant execute on function erp_private.grow_context(uuid),public.erp_grow_context(uuid) to authenticated;
-- A stale application revision is a terminal HTTP conflict, not a retryable
-- database serialization failure. PostgREST can retry 40001 indefinitely.
do $$
declare definition text;
begin
 definition:=pg_get_functiondef('erp_private.grow_command(uuid,uuid,text,jsonb,integer)'::regprocedure);
 if position('using errcode=''40001''' in definition)=0 then
  raise exception 'Unexpected GROW revision conflict definition.';
 end if;
 execute replace(definition,'using errcode=''40001''','using errcode=''PT409''');
end $$;
commit;
