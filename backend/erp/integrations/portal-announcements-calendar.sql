-- Additive portal data. No seeded announcements, events, identities or notifications.
begin;
create table public.erp_announcements (
 id uuid primary key,cohort_id uuid not null references public.erp_cohorts(id),
 title text not null check(length(trim(title)) between 2 and 160),body text not null check(length(trim(body)) between 1 and 10000),
 audience_all boolean not null default false,roles text[] not null default '{}',group_ids uuid[] not null default '{}',user_ids uuid[] not null default '{}',
 pinned boolean not null default true,important boolean not null default false,publish_at timestamptz not null default now(),
 revision int not null default 1,withdrawn_at timestamptz,
 created_by uuid not null references public.erp_profiles(id),created_at timestamptz not null default now(),
 check(roles<@array['mentee','asmen','mentor','program','finance','system']::text[]),
 check(audience_all or cardinality(roles)+cardinality(group_ids)+cardinality(user_ids)>0)
);
create table public.erp_announcement_history (
 id uuid primary key default gen_random_uuid(),announcement_id uuid not null references public.erp_announcements(id),
 actor_id uuid not null references public.erp_profiles(id),action text not null,snapshot jsonb not null,created_at timestamptz not null default now()
);
create table public.erp_personal_events (
 id uuid primary key,cohort_id uuid not null references public.erp_cohorts(id),user_id uuid not null references public.erp_profiles(id),
 title text not null check(length(trim(title)) between 2 and 160),starts_at timestamptz not null,ends_at timestamptz not null check(ends_at>starts_at),
 location text not null default '',revision int not null default 1,cancelled_at timestamptz,created_at timestamptz not null default now()
);
create index erp_announcement_cohort_time on public.erp_announcements(cohort_id,publish_at);
create index erp_announcement_creator on public.erp_announcements(created_by);
create index erp_announcement_history_parent on public.erp_announcement_history(announcement_id,created_at);
create index erp_announcement_history_actor on public.erp_announcement_history(actor_id);
create index erp_personal_owner_time on public.erp_personal_events(user_id,cohort_id,starts_at);
create index erp_personal_cohort on public.erp_personal_events(cohort_id);
alter table public.erp_announcements enable row level security;
alter table public.erp_announcement_history enable row level security;
alter table public.erp_personal_events enable row level security;
revoke all on public.erp_announcements,public.erp_announcement_history,public.erp_personal_events from public,anon,authenticated;
-- All access goes through scoped RPCs, including for authenticated users.
create policy portal_rpc_only on public.erp_announcements for all to authenticated using(false) with check(false);
create policy portal_rpc_only on public.erp_announcement_history for all to authenticated using(false) with check(false);
create policy portal_rpc_only on public.erp_personal_events for all to authenticated using(false) with check(false);

create function erp_private.portal_workspace(p_cohort uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_c uuid;v_actor public.erp_profiles;v_manage boolean;v_groups uuid[];
begin
 if not erp_private.session_valid() then raise exception 'Masuk kembali untuk melanjutkan.' using errcode='42501';end if;
 select * into v_actor from public.erp_profiles where id=auth.uid() and active;
 if v_actor.id is null then raise exception 'Akun belum aktif.' using errcode='42501';end if;
 if p_cohort is null then select id into v_c from public.erp_cohorts where erp_private.can_cohort(id) order by starts_on desc limit 1;
 elsif erp_private.can_cohort(p_cohort) then v_c:=p_cohort;
 else raise exception 'Cohort tidak dapat diakses.' using errcode='42501';end if;
 v_manage:=coalesce(erp_private.manages(v_c),false);
 select coalesce(array_agg(id),'{}'::uuid[]) into v_groups from public.erp_groups g where g.cohort_id=v_c and (v_manage or g.mentor_id=auth.uid() or g.asmen_id=auth.uid() or exists(select 1 from public.erp_group_members m where m.group_id=g.id and m.user_id=auth.uid() and m.active));
 return jsonb_build_object('actor',to_jsonb(v_actor),'selectedCohort',v_c,'canManage',v_manage,
 'cohorts',coalesce((select jsonb_agg(to_jsonb(c) order by starts_on) from public.erp_cohorts c where erp_private.can_cohort(c.id)),'[]'::jsonb),
 'groups',coalesce((select jsonb_agg(to_jsonb(g)) from public.erp_groups g where g.id=any(v_groups)),'[]'::jsonb),
 'profiles',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'display_name',p.display_name,'roles',p.roles,'active',p.active)) from public.erp_profiles p where p.id=auth.uid() or (v_manage and exists(select 1 from public.erp_enrolments e where e.cohort_id=v_c and e.user_id=p.id)) or exists(select 1 from public.erp_groups g where g.id=any(v_groups) and (g.mentor_id=p.id or g.asmen_id=p.id or exists(select 1 from public.erp_group_members m where m.group_id=g.id and m.user_id=p.id and m.active)))),'[]'::jsonb),
 'enrolments',coalesce((select jsonb_agg(to_jsonb(e)) from public.erp_enrolments e where e.cohort_id=v_c and (v_manage or e.user_id=auth.uid())),'[]'::jsonb),
 'members',coalesce((select jsonb_agg(to_jsonb(m)) from public.erp_group_members m where m.group_id=any(v_groups) and m.active),'[]'::jsonb),
 'announcements',coalesce((select jsonb_agg(to_jsonb(a) order by a.publish_at desc) from public.erp_announcements a where a.cohort_id=v_c and (v_manage or (a.withdrawn_at is null and a.publish_at<=now() and (a.audience_all or a.roles&&v_actor.roles or auth.uid()=any(a.user_ids) or a.group_ids&&v_groups)))),'[]'::jsonb),
 'activities',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',case s.kind when 'mentoring' then 'Sesi mentoring' else 'Check-in' end,'starts_at',s.starts_at,'ends_at',null,'cal','kelompok','group_id',s.group_id,'location','','cancelled',s.cancelled,'revision',null)) from public.erp_sessions s where s.cohort_id=v_c and (v_manage or s.group_id=any(v_groups)) and (not erp_private.has_role('mentee') or auth.uid()=any(s.participant_ids) or v_manage or exists(select 1 from public.erp_groups g where g.id=s.group_id and (g.mentor_id=auth.uid() or g.asmen_id=auth.uid())))),'[]'::jsonb)
 ||coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'title',e.name,'starts_at',e.starts_at,'ends_at',e.ends_at,'cal','program','location','','kind',e.kind,'closed',e.closed,'cancelled',false,'revision',e.revision)) from public.erp_attendance_events e where e.cohort_id=v_c and (v_manage or exists(select 1 from public.erp_attendance_participants p where p.event_id=e.id and p.user_id=auth.uid()))),'[]'::jsonb)
 ||coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'starts_at',e.starts_at,'ends_at',e.ends_at,'cal','pribadi','location',e.location,'cancelled',e.cancelled_at is not null,'revision',e.revision)) from public.erp_personal_events e where e.cohort_id=v_c and e.user_id=auth.uid()),'[]'::jsonb));
end $$;
create function erp_private.portal_command(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_c uuid:=(p->>'cohort')::uuid;v_id uuid:=(p->>'id')::uuid;v_action text:=p->>'action';v_a public.erp_announcements;v_e public.erp_personal_events;v_roles text[];v_groups uuid[];v_users uuid[];
begin
 if not erp_private.session_valid() or not exists(select 1 from public.erp_profiles where id=auth.uid() and active) or not coalesce(erp_private.can_cohort(v_c),false) then raise exception 'Cohort tidak dapat diakses.' using errcode='42501';end if;
 if v_action in ('publish','withdraw') then
  if not erp_private.manages(v_c) then raise exception 'Hanya pengelola cohort yang ditugaskan dapat menerbitkan pengumuman.' using errcode='42501';end if;
  perform pg_advisory_xact_lock(hashtext(v_id::text));
  select * into v_a from public.erp_announcements where id=v_id for update;
  if v_action='withdraw' then
   if v_a.cohort_id is distinct from v_c then raise exception 'Pengumuman tidak tersedia.';end if;
   if v_a.revision is distinct from (p->>'expected')::int then raise exception 'Data berubah. Muat ulang sebelum menarik pengumuman.' using errcode='40001';end if;
   update public.erp_announcements set withdrawn_at=now(),revision=revision+1 where id=v_id returning * into v_a;
  else
   select coalesce(array_agg(value),'{}'::text[]) into v_roles from jsonb_array_elements_text(coalesce(p->'roles','[]'::jsonb));
   select coalesce(array_agg(value::uuid),'{}'::uuid[]) into v_groups from jsonb_array_elements_text(coalesce(p->'groups','[]'::jsonb));
   select coalesce(array_agg(value::uuid),'{}'::uuid[]) into v_users from jsonb_array_elements_text(coalesce(p->'users','[]'::jsonb));
   if not v_roles<@array['mentee','asmen','mentor','program','finance','system']::text[] or exists(select 1 from unnest(v_groups) g where not exists(select 1 from public.erp_groups where id=g and cohort_id=v_c)) or exists(select 1 from unnest(v_users) u where not exists(select 1 from public.erp_enrolments where user_id=u and cohort_id=v_c and active)) then raise exception 'Penerima harus berasal dari cohort yang sama.';end if;
   if v_a.id is not null then
    if v_a.cohort_id=v_c and v_a.created_by=auth.uid() and v_a.title=trim(p->>'title') and v_a.body=trim(p->>'body') and v_a.audience_all=coalesce((p->>'all')::boolean,false) and v_a.roles=v_roles and v_a.group_ids=v_groups and v_a.user_ids=v_users and v_a.pinned=coalesce((p->>'pinned')::boolean,true) and v_a.important=coalesce((p->>'important')::boolean,false) and ((p->>'publish_at') is null or v_a.publish_at=(p->>'publish_at')::timestamptz) then return jsonb_build_object('id',v_id,'duplicate',true);end if;
    raise exception 'ID pengumuman sudah dipakai oleh data berbeda.' using errcode='40001';
   end if;
   insert into public.erp_announcements(id,cohort_id,title,body,audience_all,roles,group_ids,user_ids,pinned,important,publish_at,created_by) values(v_id,v_c,trim(p->>'title'),trim(p->>'body'),coalesce((p->>'all')::boolean,false),v_roles,v_groups,v_users,coalesce((p->>'pinned')::boolean,true),coalesce((p->>'important')::boolean,false),coalesce((p->>'publish_at')::timestamptz,now()),auth.uid()) returning * into v_a;
  end if;
  insert into public.erp_announcement_history(announcement_id,actor_id,action,snapshot) values(v_id,auth.uid(),v_action,to_jsonb(v_a));
 elsif v_action in ('personal_save','personal_cancel') then
  perform pg_advisory_xact_lock(hashtext(v_id::text));
  select * into v_e from public.erp_personal_events where id=v_id for update;
  if v_e.id is not null and (v_e.user_id<>auth.uid() or v_e.cohort_id<>v_c) then raise exception 'Kalender pribadi hanya dapat dikelola pemilik.' using errcode='42501';end if;
  if v_action='personal_cancel' then
   if v_e.id is null or v_e.revision is distinct from (p->>'expected')::int then raise exception 'Data berubah. Muat ulang kalender.' using errcode='40001';end if;
   update public.erp_personal_events set cancelled_at=now(),revision=revision+1 where id=v_id;
  else
   if v_e.id is not null then
    if v_e.title=trim(p->>'title') and v_e.starts_at=(p->>'starts_at')::timestamptz and v_e.ends_at=(p->>'ends_at')::timestamptz and v_e.location=coalesce(p->>'location','') then return jsonb_build_object('id',v_id,'duplicate',true);end if;
    raise exception 'ID jadwal sudah dipakai; buat perubahan sebagai jadwal baru.' using errcode='40001';
   end if;
   insert into public.erp_personal_events(id,cohort_id,user_id,title,starts_at,ends_at,location) values(v_id,v_c,auth.uid(),trim(p->>'title'),(p->>'starts_at')::timestamptz,(p->>'ends_at')::timestamptz,coalesce(p->>'location',''));
  end if;
 else raise exception 'Permintaan portal tidak dikenali.';end if;
 insert into public.erp_audit(cohort_id,actor_id,action,entity_id) values(v_c,auth.uid(),'portal_'||v_action,v_id);
 return jsonb_build_object('id',v_id,'ok',true);
end $$;
create function public.erp_portal_workspace(p_cohort uuid default null) returns jsonb language sql set search_path='' as $$select erp_private.portal_workspace(p_cohort)$$;
create function public.erp_portal_command(p_payload jsonb) returns jsonb language sql set search_path='' as $$select erp_private.portal_command(p_payload)$$;
revoke all on function erp_private.portal_workspace(uuid),erp_private.portal_command(jsonb),public.erp_portal_workspace(uuid),public.erp_portal_command(jsonb) from public,anon;
grant execute on function erp_private.portal_workspace(uuid),erp_private.portal_command(jsonb),public.erp_portal_workspace(uuid),public.erp_portal_command(jsonb) to authenticated;
commit;
