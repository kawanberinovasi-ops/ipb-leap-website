-- Event operations stay separate from program/account/assessment management.
begin;
alter table public.erp_profiles drop constraint erp_profiles_roles_check;
alter table public.erp_profiles add constraint erp_profiles_roles_check check(roles <@ array['mentee','asmen','mentor','program','finance','system','event']::text[]);
alter table public.erp_enrolments drop constraint erp_enrolments_role_check;
alter table public.erp_enrolments add constraint erp_enrolments_role_check check(role in ('mentee','asmen','mentor','program','finance','event'));
create table erp_private.event_staff (
 cohort_id uuid not null references public.erp_cohorts(id),user_id uuid not null references public.erp_profiles(id),
 division text not null check(length(trim(division)) between 2 and 120),active boolean not null default true,
 primary key(cohort_id,user_id)
);
create index event_staff_user on erp_private.event_staff(user_id);
alter table erp_private.event_staff enable row level security;
revoke all on erp_private.event_staff from public,anon,authenticated;
create policy event_staff_service_only on erp_private.event_staff for all to authenticated using(false) with check(false);
create or replace function erp_private.attendance_operator(c uuid) returns boolean language sql stable security definer set search_path='' as $$
 select (erp_private.has_role('program') and exists(select 1 from public.erp_cohort_staff s where s.cohort_id=c and s.user_id=auth.uid() and s.can_manage))
 or (erp_private.has_role('event') and exists(select 1 from erp_private.event_staff s join public.erp_enrolments e on e.cohort_id=s.cohort_id and e.user_id=s.user_id where s.cohort_id=c and s.user_id=auth.uid() and s.active and e.active and e.role='event'))
$$;
create or replace function erp_private.attendance_subject(c uuid,u uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.erp_enrolments e join public.erp_profiles p on p.id=e.user_id
 where e.cohort_id=c and e.user_id=u and e.role in ('mentee','asmen') and e.role=any(p.roles) and e.active
 and (p.active or erp_private.profile_pending_activation(p.id)))
$$;
-- A restricted roster endpoint: no answers, scores, groups, or account commands.
create function erp_private.attendance_workspace(c uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare selected uuid;operator boolean;
begin
 if not erp_private.session_valid() then raise exception 'Masuk kembali untuk melanjutkan.' using errcode='42501';end if;
 if c is null then select id into selected from public.erp_cohorts h where erp_private.attendance_operator(h.id) or erp_private.attendance_subject(h.id,auth.uid()) order by starts_on desc limit 1;else selected:=c;end if;
 operator:=coalesce(erp_private.attendance_operator(selected),false);
 if selected is null or not (operator or erp_private.attendance_subject(selected,auth.uid())) then raise exception 'Belum mendapat penugasan kehadiran pada cohort ini.' using errcode='42501';end if;
 return jsonb_build_object('selectedCohort',selected,'canAttendManage',operator,
 'division',(select division from erp_private.event_staff where cohort_id=selected and user_id=auth.uid() and active),
 'cohorts',coalesce((select jsonb_agg(to_jsonb(h) order by starts_on) from public.erp_cohorts h where erp_private.attendance_operator(h.id) or erp_private.attendance_subject(h.id,auth.uid())),'[]'::jsonb),
 'profiles',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'display_name',p.display_name,'email',p.email,'roles',p.roles,'active',p.active,'pending_activation',not p.active and erp_private.profile_pending_activation(p.id)) order by p.display_name)
 from public.erp_profiles p where (operator or p.id=auth.uid()) and exists(select 1 from public.erp_enrolments e where e.cohort_id=selected and e.user_id=p.id and e.role in ('mentee','asmen'))),'[]'::jsonb),
 'enrolments',coalesce((select jsonb_agg(to_jsonb(e)) from public.erp_enrolments e where e.cohort_id=selected and e.role in ('mentee','asmen') and (operator or e.user_id=auth.uid())),'[]'::jsonb),
 'staff','[]'::jsonb,'groups','[]'::jsonb,'members','[]'::jsonb,'records','[]'::jsonb,'sessions','[]'::jsonb,'audit','[]'::jsonb);
end $$;
create function public.erp_attendance_workspace(p_cohort uuid default null) returns jsonb language sql set search_path='' as $$select erp_private.attendance_workspace(p_cohort)$$;
revoke all on function erp_private.attendance_workspace(uuid),public.erp_attendance_workspace(uuid) from public,anon;
grant execute on function erp_private.attendance_workspace(uuid),public.erp_attendance_workspace(uuid) to authenticated;
create or replace function erp_private.attendance_command(action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c uuid; u uuid; eid uuid; e public.erp_attendance_events; a public.erp_attendance; old_status text; tok text; ids uuid[]; operator_name text; target uuid;
begin
 if not erp_private.session_valid() or not exists(select 1 from public.erp_profiles where id=auth.uid() and active) then raise exception 'Masuk kembali untuk melanjutkan.' using errcode='42501'; end if;
 if action in ('state','card') then
  c:=(p->>'cohort')::uuid; u:=coalesce(nullif(p->>'mentee','')::uuid,auth.uid());
  if not erp_private.attendance_operator(c) and not ((erp_private.has_role('mentee') or erp_private.has_role('asmen')) and u=auth.uid() and erp_private.attendance_subject(c,u)) then raise exception 'Kehadiran tidak dapat diakses.' using errcode='42501'; end if;
  if action='card' then
   if not erp_private.attendance_subject(c,u) then raise exception 'Peserta tidak aktif atau belum terdaftar pada cohort ini.'; end if;
   insert into erp_private.attendance_cards(user_id,token) values(u,replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','')) on conflict(user_id) do nothing;
   select token into tok from erp_private.attendance_cards where user_id=u;
   return jsonb_build_object('payload','ipbleap:attendance:v1:'||tok);
  end if;
  return jsonb_build_object(
   'events',coalesce((select jsonb_agg(to_jsonb(z) order by starts_at desc) from public.erp_attendance_events z where z.cohort_id=c and (erp_private.attendance_operator(c) or exists(select 1 from public.erp_attendance_participants m where m.event_id=z.id and m.user_id=u))),'[]'::jsonb),
   'participants',coalesce((select jsonb_agg(to_jsonb(m)) from public.erp_attendance_participants m join public.erp_attendance_events z on z.id=m.event_id where z.cohort_id=c and (erp_private.attendance_operator(c) or m.user_id=u)),'[]'::jsonb),
   'attendance',coalesce((select jsonb_agg(to_jsonb(ar)||jsonb_build_object('operator',n.display_name)) from public.erp_attendance ar join public.erp_attendance_events z on z.id=ar.event_id join public.erp_profiles n on n.id=ar.operator_id where z.cohort_id=c and (erp_private.attendance_operator(c) or ar.user_id=u)),'[]'::jsonb),
   'history',coalesce((select jsonb_agg(to_jsonb(h)||jsonb_build_object('operator',n.display_name) order by h.created_at desc) from public.erp_attendance_history h join public.erp_attendance ar on ar.id=h.attendance_id join public.erp_attendance_events z on z.id=ar.event_id join public.erp_profiles n on n.id=h.operator_id where z.cohort_id=c and (erp_private.attendance_operator(c) or ar.user_id=u)),'[]'::jsonb));
 end if;
 if action='event' then
  c:=(p->>'cohort')::uuid; eid:=(p->>'id')::uuid;
  if not erp_private.attendance_operator(c) then raise exception 'Tidak ditugaskan mencatat kehadiran.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtext(eid::text));
  select array_agg(value::uuid order by value::uuid) into ids from jsonb_array_elements_text(p->'participants');
  if coalesce(cardinality(ids),0)=0 or (select count(distinct x) from unnest(ids) x)<>cardinality(ids) then raise exception 'Pilih peserta kegiatan yang berbeda.'; end if;
  if exists(select 1 from unnest(ids) x where not erp_private.attendance_subject(c,x)) then raise exception 'Peserta harus Mentee atau Asmen terdaftar pada cohort yang sama.'; end if;
  select * into e from public.erp_attendance_events where id=eid;
  if e.id is not null then
   if e.cohort_id=c and e.name=trim(p->>'name') and e.kind=p->>'kind' and e.starts_at=(p->>'starts_at')::timestamptz and e.ends_at=(p->>'ends_at')::timestamptz and ids=(select array_agg(user_id order by user_id) from public.erp_attendance_participants where event_id=eid) then return jsonb_build_object('id',eid,'duplicate',true); end if;
   raise exception 'ID kegiatan sudah digunakan oleh data berbeda.' using errcode='40001';
  end if;
  insert into public.erp_attendance_events(id,cohort_id,name,kind,starts_at,ends_at,created_by) values(eid,c,trim(p->>'name'),p->>'kind',(p->>'starts_at')::timestamptz,(p->>'ends_at')::timestamptz,auth.uid());
  insert into public.erp_attendance_participants(event_id,user_id,display_name) select eid,id,display_name from public.erp_profiles where id=any(ids);
  insert into public.erp_audit(cohort_id,actor_id,action,entity_id) values(c,auth.uid(),'Membuat kegiatan presensi',eid);
  return jsonb_build_object('id',eid);
 end if;
 eid:=(p->>'event')::uuid;
 select * into e from public.erp_attendance_events where id=eid for update;
 if e.id is null or not erp_private.attendance_operator(e.cohort_id) then raise exception 'Kegiatan tidak dapat dikelola.' using errcode='42501'; end if;
 if action='close' then
  if e.revision is distinct from (p->>'expected')::int then raise exception 'Data berubah. Muat ulang kegiatan.' using errcode='40001'; end if;
  update public.erp_attendance_events set closed=true,revision=revision+1 where id=eid;
  insert into public.erp_audit(cohort_id,actor_id,action,entity_id) values(e.cohort_id,auth.uid(),'Menutup presensi',eid);
  return jsonb_build_object('ok',true);
 end if;
 if action='scan' then
  if e.closed or now()<e.starts_at or now()>e.ends_at then raise exception 'Presensi kegiatan belum dibuka atau sudah ditutup.'; end if;
  if p->>'payload' !~ '^ipbleap:attendance:v1:[a-f0-9]{64}$' then raise exception 'QR presensi tidak dikenali.'; end if;
  select user_id into u from erp_private.attendance_cards where token=substring(p->>'payload' from 23);
 else u:=(p->>'mentee')::uuid; end if;
 if u is null or not erp_private.attendance_subject(e.cohort_id,u) or not exists(select 1 from public.erp_attendance_participants where event_id=eid and user_id=u) then raise exception 'Peserta tidak aktif atau bukan peserta kegiatan ini.'; end if;
 select * into a from public.erp_attendance where event_id=eid and user_id=u for update;
 select display_name into operator_name from public.erp_profiles where id=u;
 if action='scan' and a.id is not null then
  if a.status<>'Hadir' then raise exception 'Status sudah Izin/Absen. Gunakan koreksi dengan alasan.'; end if;
  return jsonb_build_object('duplicate',true,'name',operator_name,'attendance',to_jsonb(a));
 elsif action='correct' then
  if coalesce(length(trim(p->>'reason')),0)<5 or p->>'status' not in ('Hadir','Izin','Absen') then raise exception 'Pilih status dan isi alasan sedikitnya lima karakter.'; end if;
  if coalesce(a.revision,0) is distinct from (p->>'expected')::int then raise exception 'Data berubah. Muat ulang sebelum mengoreksi; isian tetap tersedia.' using errcode='40001'; end if;
 elsif action<>'scan' then raise exception 'Permintaan kehadiran tidak dikenali.'; end if;
 old_status:=a.status;
 insert into public.erp_attendance(event_id,user_id,status,method,operator_id) values(eid,u,case when action='scan' then 'Hadir' else p->>'status' end,case when action='scan' then 'qr' else 'manual' end,auth.uid()) on conflict(event_id,user_id) do update set status=excluded.status,method=excluded.method,operator_id=auth.uid(),updated_at=now(),revision=public.erp_attendance.revision+1 returning * into a;
 insert into public.erp_attendance_history(attendance_id,previous_status,status,reason,operator_id) values(a.id,old_status,a.status,case when action='scan' then 'Scan QR presensi' else trim(p->>'reason') end,auth.uid());
 return jsonb_build_object('duplicate',false,'name',operator_name,'attendance',to_jsonb(a));
end $$;


do $patch$
declare definition text;
begin
 definition:=pg_get_functiondef('erp_private.managed_account_service(text,jsonb)'::regprocedure);
 if position('roles_requested<@array[''mentee'',''mentor'',''asmen'',''program'',''finance'']' in definition)=0 then raise exception 'Unexpected managed account definition';end if;
 definition:=replace(definition,'roles_requested<@array[''mentee'',''mentor'',''asmen'',''program'',''finance'']','roles_requested<@array[''mentee'',''mentor'',''asmen'',''program'',''finance'',''event'']');
 definition:=replace(definition,'roles_requested[1] not in (''mentee'',''asmen'')','roles_requested[1] not in (''mentee'',''asmen'',''event'')');
 definition:=replace(definition,'if action=''authorize'' then','if roles_requested[1]=''event'' and coalesce(length(trim(p->>''division'')),0) not between 2 and 120 then raise exception ''Isi divisi Tim Event.'';end if; if action=''authorize'' then');
 definition:=replace(definition,'else
  select * into t from public.erp_profiles where id=target for update;',
 'if roles_requested[1]=''event'' then insert into erp_private.event_staff(cohort_id,user_id,division) values(c,target,trim(p->>''division''));end if;
 else
  select * into t from public.erp_profiles where id=target for update;');
 execute definition;
 -- Event operators see their created/scheduled activities in the existing program calendar.
 definition:=pg_get_functiondef('erp_private.portal_workspace(uuid)'::regprocedure);
 definition:=replace(definition,'e.cohort_id=v_c and (v_manage or exists(select 1 from public.erp_attendance_participants','e.cohort_id=v_c and (v_manage or erp_private.attendance_operator(v_c) or exists(select 1 from public.erp_attendance_participants');
 execute definition;
end $patch$;
-- Owner/admin Auth tooling can finish a new Event identity without granting broader roles.
create function erp_private.event_account_service(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=(p->>'user')::uuid;c uuid:=(p->>'cohort')::uuid;a auth.users;t public.erp_profiles;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Akses layanan ditolak.' using errcode='42501';end if;
 if coalesce(length(trim(p->>'division')),0) not between 2 and 120 then raise exception 'Isi divisi Tim Event.';end if;
 if not exists(select 1 from public.erp_cohorts where id=c) then raise exception 'Cohort tidak tersedia.';end if;
 select * into a from auth.users where id=u;
 if a.id is null or a.email is distinct from p->>'email' or a.email_confirmed_at is null then raise exception 'Identitas Auth belum siap.';end if;
 perform pg_advisory_xact_lock(hashtext(u::text));select * into t from public.erp_profiles where id=u;
 if t.id is not null then
  if t.roles=array['event']::text[] and exists(select 1 from erp_private.event_staff where user_id=u and cohort_id=c and division=trim(p->>'division')) then return jsonb_build_object('ok',true,'duplicate',true);end if;
  raise exception 'Akun sudah memiliki penugasan. Tidak diubah oleh layanan pendaftaran Event.';
 end if;
 insert into public.erp_profiles(id,email,display_name,roles) values(u,a.email,'Tim Event',array['event']);
 insert into public.erp_enrolments(cohort_id,user_id,role) values(c,u,'event');
 insert into erp_private.event_staff(cohort_id,user_id,division) values(c,u,trim(p->>'division'));
 insert into erp_private.password_setup(user_id) values(u);
 update public.erp_cohorts set revision=revision+1 where id=c;
 insert into public.erp_audit(cohort_id,action,entity_id) values(c,'Mendaftarkan Tim Event melalui layanan admin; wajib ganti password',u);
 return jsonb_build_object('ok',true);
end $$;
create function public.erp_event_account_service(p jsonb) returns jsonb language sql set search_path='' as $$select erp_private.event_account_service(p)$$;
revoke all on function erp_private.event_account_service(jsonb),public.erp_event_account_service(jsonb) from public,anon,authenticated;
grant execute on function erp_private.event_account_service(jsonb),public.erp_event_account_service(jsonb) to service_role;
commit;
