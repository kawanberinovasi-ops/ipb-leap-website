create function erp_private.ensure_profile() returns jsonb language plpgsql security definer set search_path='' as $$
declare u auth.users; p public.erp_profiles;
begin
 if not erp_private.session_valid() then raise exception 'Sesi akun belum terverifikasi. Masuk kembali.' using errcode='42501'; end if;
 select * into u from auth.users where id=auth.uid();
 insert into public.erp_profiles(id,display_name,email)
 values(u.id,coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'),''),split_part(u.email,'@',1)),u.email)
 on conflict(id) do update set email=excluded.email,updated_at=now();
 select * into p from public.erp_profiles where id=u.id;
 return to_jsonb(p)||jsonb_build_object('sessionId',auth.jwt()->>'session_id');
end;
$$;

create function erp_private.append_version(p_record uuid,p_status text,p_data jsonb,p_action text) returns uuid language plpgsql set search_path='' as $$
declare v_id uuid; n int;
begin
 update public.erp_records set latest_version=latest_version+1,updated_at=now() where id=p_record returning latest_version into n;
 insert into public.erp_versions(record_id,number,status,data,actor_id,action) values(p_record,n,p_status,p_data,auth.uid(),p_action) returning id into v_id;
 return v_id;
end;
$$;

create function erp_private.record_bundle(p_record uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(r) || jsonb_build_object(
 'latest_status',(select v.status from public.erp_versions v where v.record_id=r.id order by v.number desc limit 1),
 'versions',coalesce((select jsonb_agg(to_jsonb(v) order by v.number) from public.erp_versions v where v.record_id=r.id and (
  (r.mentee_id=auth.uid() and (r.kind<>'review' or v.status='Diterbitkan'))
  or (r.kind='review' and (erp_private.staff_for(r.cohort_id,r.mentee_id,'mentor') or erp_private.assesses(r.cohort_id)))
  or (r.kind<>'review' and v.status<>'Draft') or v.status='Diterbitkan'
 )), '[]'::jsonb),
 'checks',coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.erp_checks c where c.record_id=r.id),'[]'::jsonb),
 'publications',coalesce((select jsonb_agg(to_jsonb(p) order by p.number) from public.erp_publications p where p.record_id=r.id),'[]'::jsonb)
 ) from public.erp_records r where r.id=p_record and erp_private.can_subject(r.cohort_id,r.mentee_id);
$$;

create function erp_private.workspace(p_cohort uuid,p_mentee uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare me jsonb; selected_cohort uuid; selected_mentee uuid;
begin
 me:=erp_private.ensure_profile();
 if not (me->>'active')::boolean then return jsonb_build_object('actor',me,'cohorts','[]'::jsonb,'profiles','[]'::jsonb,'enrolments','[]'::jsonb,'groups','[]'::jsonb,'members','[]'::jsonb,'sessions','[]'::jsonb,'records','[]'::jsonb,'staff','[]'::jsonb,'audit','[]'::jsonb); end if;
 if p_cohort is not null then
  if not erp_private.can_cohort(p_cohort) then raise exception 'Cohort tidak dapat diakses.' using errcode='42501'; end if;
  selected_cohort:=p_cohort;
 else
  select id into selected_cohort from public.erp_cohorts c where erp_private.can_cohort(c.id) order by c.starts_on desc limit 1;
 end if;
 if p_mentee is not null and erp_private.can_subject(selected_cohort,p_mentee) then selected_mentee:=p_mentee;
 elsif erp_private.has_role('mentee') and erp_private.can_subject(selected_cohort,auth.uid()) then selected_mentee:=auth.uid();
 else select user_id into selected_mentee from public.erp_enrolments e where e.cohort_id=selected_cohort and e.role='mentee' and e.active and erp_private.can_subject(e.cohort_id,e.user_id) order by e.user_id limit 1;
 end if;
 return jsonb_build_object(
 'actor',me,'selectedCohort',selected_cohort,'selectedMentee',selected_mentee,
 'cohorts',coalesce((select jsonb_agg(to_jsonb(c) order by c.starts_on desc) from public.erp_cohorts c where erp_private.can_cohort(c.id)),'[]'::jsonb),
 'profiles',coalesce((select jsonb_agg(to_jsonb(p) order by p.display_name) from public.erp_profiles p where erp_private.can_profile(p.id)),'[]'::jsonb),
 'enrolments',coalesce((select jsonb_agg(to_jsonb(e)) from public.erp_enrolments e where e.cohort_id=selected_cohort and (erp_private.manages(e.cohort_id) or erp_private.can_subject(e.cohort_id,e.user_id) or e.user_id=auth.uid())),'[]'::jsonb),
 'staff',coalesce((select jsonb_agg(to_jsonb(s)) from public.erp_cohort_staff s where s.cohort_id=selected_cohort and erp_private.can_cohort(s.cohort_id)),'[]'::jsonb),
 'groups',coalesce((select jsonb_agg(to_jsonb(g) order by g.name) from public.erp_groups g where g.cohort_id=selected_cohort and erp_private.can_group(g.id)),'[]'::jsonb),
 'members',coalesce((select jsonb_agg(to_jsonb(m)) from public.erp_group_members m join public.erp_groups g on g.id=m.group_id where g.cohort_id=selected_cohort and erp_private.can_group(g.id)),'[]'::jsonb),
 'sessions',coalesce((select jsonb_agg(to_jsonb(s) order by s.starts_at) from public.erp_sessions s where s.cohort_id=selected_cohort and erp_private.can_group(s.group_id)),'[]'::jsonb),
 'records',coalesce((select jsonb_agg(erp_private.record_bundle(r.id) order by r.updated_at desc) from public.erp_records r where r.cohort_id=selected_cohort and r.mentee_id=selected_mentee and erp_private.can_subject(r.cohort_id,r.mentee_id)),'[]'::jsonb),
 'audit',coalesce((select jsonb_agg(to_jsonb(a)) from (select * from public.erp_audit a where erp_private.manages(a.cohort_id) order by created_at desc limit 100) a),'[]'::jsonb)
 );
end;
$$;

create function public.erp_bootstrap() returns jsonb language sql security invoker set search_path='' as $$select erp_private.ensure_profile()$$;
create function public.erp_workspace(p_cohort uuid default null,p_mentee uuid default null) returns jsonb language sql security invoker set search_path='' as $$select erp_private.workspace(p_cohort,p_mentee)$$;
revoke all on function public.erp_bootstrap(),public.erp_workspace(uuid,uuid) from public,anon;
grant execute on function public.erp_bootstrap(),public.erp_workspace(uuid,uuid) to authenticated;
revoke all on function erp_private.ensure_profile(),erp_private.append_version(uuid,text,jsonb,text),erp_private.record_bundle(uuid),erp_private.workspace(uuid,uuid) from public,anon,authenticated;
grant execute on function erp_private.ensure_profile(),erp_private.workspace(uuid,uuid) to authenticated;
