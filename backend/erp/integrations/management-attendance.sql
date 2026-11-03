-- Additive integration: existing identities, assignments and assessment records remain unchanged.
-- No seeds. Run only this reviewed file; pending/360.sql remains disabled.
begin;

create function erp_private.track_pathway_valid(field text,pathway text) returns boolean language sql immutable set search_path='' as $$
 select coalesce(case field
 when 'Entrepreneur / Business' then pathway in ('Validate','Grow')
 when 'Academic & Research' then pathway in ('Produce','Advance')
 when 'Professional / Corporate / Bureaucracy' then pathway in ('Career Acceleration','Career Transition')
 when 'Politics / Public Leadership' then pathway in ('Community Leadership','Organizational Leadership','Policy / Public Initiative')
 when 'Social & Community / Social Impact' then pathway in ('Implement','Strengthen / Scale') else false end,false)
$$;
revoke all on function erp_private.track_pathway_valid(text,text) from public,anon,authenticated;


create function erp_private.attendance_operator(c uuid) returns boolean language sql stable security definer set search_path='' as $$
 select erp_private.has_role('program') and exists(select 1 from public.erp_cohort_staff s where s.cohort_id=c and s.user_id=auth.uid() and s.can_manage)
$$;
create function erp_private.attendance_subject(c uuid,u uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.erp_enrolments e join public.erp_profiles p on p.id=e.user_id where e.cohort_id=c and e.user_id=u and e.role='mentee' and e.active and p.active and 'mentee'=any(p.roles))
$$;

create table public.erp_attendance_events (
 id uuid primary key, cohort_id uuid not null references public.erp_cohorts(id),
 name text not null check(length(trim(name)) between 2 and 150),
 kind text not null check(kind in ('Common Class','Mentoring','Event')),
 starts_at timestamptz not null, ends_at timestamptz not null check(ends_at>starts_at),
 closed boolean not null default false, revision integer not null default 1,
 created_by uuid not null references public.erp_profiles(id), created_at timestamptz not null default now()
);
create table public.erp_attendance_participants (
 event_id uuid references public.erp_attendance_events(id),user_id uuid references public.erp_profiles(id),
 display_name text not null, primary key(event_id,user_id)
);
-- Cards stay private: a random attendance identifier is never an authentication credential.
create table erp_private.attendance_cards (
 user_id uuid primary key references public.erp_profiles(id), token text not null unique,
 created_at timestamptz not null default now()
);
create table public.erp_attendance (
 id uuid primary key default gen_random_uuid(),event_id uuid not null,user_id uuid not null,
 status text not null check(status in ('Hadir','Izin','Absen')),method text not null check(method in ('qr','manual')),
 operator_id uuid not null references public.erp_profiles(id), recorded_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),revision integer not null default 1,
 unique(event_id,user_id),foreign key(event_id,user_id) references public.erp_attendance_participants(event_id,user_id)
);
create table public.erp_attendance_history (
 id uuid primary key default gen_random_uuid(),attendance_id uuid not null references public.erp_attendance(id),
 previous_status text,status text not null,reason text not null,operator_id uuid not null references public.erp_profiles(id),
 created_at timestamptz not null default now()
);
create index erp_attendance_event_cohort on public.erp_attendance_events(cohort_id,starts_at);
create index erp_attendance_participant_user on public.erp_attendance_participants(user_id,event_id);
create index erp_attendance_user on public.erp_attendance(user_id,event_id);
create index erp_attendance_history_row on public.erp_attendance_history(attendance_id,created_at);
create index erp_attendance_history_operator on public.erp_attendance_history(operator_id);
create index erp_attendance_operator on public.erp_attendance(operator_id);
create index erp_attendance_event_creator on public.erp_attendance_events(created_by);
alter table public.erp_attendance_events enable row level security;
alter table public.erp_attendance_participants enable row level security;
alter table public.erp_attendance enable row level security;
alter table public.erp_attendance_history enable row level security;
revoke all on public.erp_attendance_events,public.erp_attendance_participants,public.erp_attendance,public.erp_attendance_history from public,anon,authenticated;
revoke all on erp_private.attendance_cards from public,anon,authenticated;

-- Only metadata is exposed to management. No answer data, proof, observer response or source snapshots.
create function erp_private.management_workspace(c uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare selected uuid; me public.erp_profiles;
begin
 if not erp_private.session_valid() then raise exception 'Masuk kembali untuk melanjutkan.' using errcode='42501'; end if;
 select * into me from public.erp_profiles where id=auth.uid() and active;
 if me.id is null then raise exception 'Akun belum aktif.' using errcode='42501'; end if;
 if c is not null and not erp_private.manages(c) then raise exception 'Tidak ditugaskan mengelola cohort ini.' using errcode='42501'; end if;
 if c is null then select id into selected from public.erp_cohorts h where erp_private.manages(h.id) order by starts_on desc limit 1; else selected:=c; end if;
 if not erp_private.has_role('system') and selected is null then raise exception 'Belum mendapat penugasan mengelola cohort.' using errcode='42501'; end if;
 return jsonb_build_object('actor',to_jsonb(me),'selectedCohort',selected,
 'revision',coalesce((select revision from public.erp_cohorts where id=selected),0),
 'cohorts',coalesce((select jsonb_agg(to_jsonb(h) order by starts_on) from public.erp_cohorts h where erp_private.manages(h.id)),'[]'::jsonb),
 'profiles',coalesce((select jsonb_agg(to_jsonb(p) order by p.display_name) from public.erp_profiles p where erp_private.has_role('system') or exists(select 1 from public.erp_enrolments e where e.cohort_id=selected and e.user_id=p.id)),'[]'::jsonb),
 'enrolments',coalesce((select jsonb_agg(to_jsonb(e)) from public.erp_enrolments e where e.cohort_id=selected),'[]'::jsonb),
 'staff',coalesce((select jsonb_agg(to_jsonb(s)) from public.erp_cohort_staff s where s.cohort_id=selected),'[]'::jsonb),
 'groups',coalesce((select jsonb_agg(to_jsonb(g)) from public.erp_groups g where g.cohort_id=selected),'[]'::jsonb),
 'members',coalesce((select jsonb_agg(to_jsonb(m)) from public.erp_group_members m join public.erp_groups g on g.id=m.group_id where g.cohort_id=selected),'[]'::jsonb),
 'sessions','[]'::jsonb,
 'records',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'cohort_id',r.cohort_id,'mentee_id',r.mentee_id,'kind',r.kind,'month_no',r.month_no,'updated_at',r.updated_at,
 'latest_status',(select status from public.erp_versions where record_id=r.id order by number desc limit 1),
 'versions',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'number',v.number,'status',v.status)) from public.erp_versions v where v.record_id=r.id),'[]'::jsonb),
 'checks',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'kind',x.kind)) from public.erp_checks x where x.record_id=r.id),'[]'::jsonb),
 'publications',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'number',p.number,'score',jsonb_build_object('total',p.score->'total'),'created_at',p.created_at)) from public.erp_publications p where p.record_id=r.id),'[]'::jsonb))) from public.erp_records r where r.cohort_id=selected),'[]'::jsonb),
 'audit',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'summary',a.action,'created_at',a.created_at,'actor_id',a.actor_id)) from (select * from public.erp_audit where cohort_id=selected order by created_at desc limit 100) a),'[]'::jsonb));
end $$;

-- Metadata writes use cohort revision; account role grants remain outside this endpoint.
create function erp_private.management_command(p jsonb,expected integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare c uuid:=(p->>'cohort')::uuid; u uuid:=(p->>'user')::uuid; g uuid; x uuid; r integer; person public.erp_profiles; e public.erp_enrolments; h public.erp_groups;
begin
 if not erp_private.session_valid() or not erp_private.manages(c) then raise exception 'Tidak ditugaskan mengelola cohort ini.' using errcode='42501'; end if;
 select revision into r from public.erp_cohorts where id=c for update;
 if r is distinct from expected then raise exception 'Data berubah. Muat ulang sebelum menyimpan.' using errcode='40001'; end if;
 if p->>'action'='account' then
  select * into person from public.erp_profiles where id=u;
  select * into e from public.erp_enrolments where cohort_id=c and user_id=u and role=p->>'role' for update;
  if e.user_id is null or (not erp_private.has_role('system') and (not person.roles<@array['mentee','mentor','asmen']::text[] or e.role not in ('mentee','mentor','asmen'))) then raise exception 'Akun tidak dapat dikelola dari cohort ini.' using errcode='42501'; end if;
  if p->>'email' is distinct from person.email then raise exception 'Email login tidak diubah melalui penempatan peserta.'; end if;
  if trim(p->>'display_name') is distinct from person.display_name then raise exception 'Nama akun mengikuti profil pemilik; ubah hanya penempatan di sini.'; end if;
  if e.role='mentee' and not erp_private.track_pathway_valid(p->>'field',p->>'pathway') then raise exception 'Isi track dan pathway peserta.'; end if;
  g:=nullif(p->>'group_id','')::uuid;
  if g is not null then
   select * into h from public.erp_groups where id=g and cohort_id=c and field=p->>'field';
   if h.id is null or not person.active then raise exception 'Kelompok dan track harus cocok; akun harus sudah diaktifkan.'; end if;
   if exists(select 1 from public.erp_group_members m join public.erp_groups k on k.id=m.group_id where k.cohort_id=c and m.user_id=u and m.active and k.id<>g) then raise exception 'Mentee sudah berada dalam kelompok lain; lepaskan penempatan lama dahulu.'; end if;
   if not exists(select 1 from public.erp_group_members where group_id=g and user_id=u and active) and (select count(*) from public.erp_group_members where group_id=g and active)>=5 then raise exception 'Kelompok maksimal lima mentee.'; end if;
  end if;
  if e.role='mentee' and exists(select 1 from public.erp_group_members m join public.erp_groups k on k.id=m.group_id where k.cohort_id=c and m.user_id=u and m.active and k.field<>p->>'field') then raise exception 'Track kelompok harus tetap sesuai dengan mentee.'; end if;
  update public.erp_enrolments set field=case when role='mentee' then p->>'field' else field end,pathway=case when role='mentee' then p->>'pathway' else pathway end,active=(p->>'active')::boolean where cohort_id=c and user_id=u and role=e.role;
  if e.role='mentee' then
   update public.erp_group_members m set active=false,left_at=now() from public.erp_groups k where k.id=m.group_id and k.cohort_id=c and m.user_id=u and m.active and (not coalesce((p->>'active')::boolean,true) or g is null or m.group_id<>g);
   if g is not null and coalesce((p->>'active')::boolean,true) and not exists(select 1 from public.erp_group_members where group_id=g and user_id=u and active) then insert into public.erp_group_members(group_id,user_id) values(g,u); end if;
   update public.erp_groups k set active=(k.mentor_id is not null and k.asmen_id is not null and (select count(*) from public.erp_group_members m join public.erp_enrolments z on z.user_id=m.user_id and z.cohort_id=c and z.role='mentee' and z.active join public.erp_profiles n on n.id=m.user_id and n.active where m.group_id=k.id and m.active)=5) where k.cohort_id=c;
  end if;
 elsif p->>'action'='group' then
  g:=coalesce(nullif(p->>'id','')::uuid,gen_random_uuid());
  if length(trim(p->>'name')) not between 2 and 100 or p->>'field' not in ('Entrepreneur / Business','Academic & Research','Professional / Corporate / Bureaucracy','Politics / Public Leadership','Social & Community / Social Impact') then raise exception 'Isi nama dan track kelompok.'; end if;
  if exists(select 1 from public.erp_groups where id=g and cohort_id<>c) then raise exception 'Kelompok tidak cocok.'; end if;
  foreach x in array array[nullif(p->>'mentor_id','')::uuid,nullif(p->>'asmen_id','')::uuid] loop
   if x is not null and not exists(select 1 from public.erp_enrolments z join public.erp_profiles a on a.id=z.user_id where z.cohort_id=c and z.user_id=x and z.active and a.active and z.role=case when x=nullif(p->>'mentor_id','')::uuid then 'mentor' else 'asmen' end and z.role=any(a.roles)) then raise exception 'Pilih pendamping aktif dengan penugasan yang sesuai.'; end if;
  end loop;
  if nullif(p->>'mentor_id','')=nullif(p->>'asmen_id','') then raise exception 'Mentor dan Asmen harus berbeda.'; end if;
  if exists(select 1 from public.erp_groups k where k.cohort_id=c and k.id<>g and (k.mentor_id=nullif(p->>'mentor_id','')::uuid or k.asmen_id=nullif(p->>'asmen_id','')::uuid)) then raise exception 'Pendamping sudah ditugaskan pada kelompok lain.'; end if;
  if exists(select 1 from public.erp_group_members m join public.erp_enrolments z on z.user_id=m.user_id and z.cohort_id=c and z.role='mentee' where m.group_id=g and m.active and z.field<>p->>'field') then raise exception 'Track kelompok mengikuti track mentee.'; end if;
  insert into public.erp_groups(id,cohort_id,name,field,mentor_id,asmen_id) values(g,c,trim(p->>'name'),p->>'field',nullif(p->>'mentor_id','')::uuid,nullif(p->>'asmen_id','')::uuid) on conflict(id) do update set name=excluded.name,field=excluded.field,mentor_id=excluded.mentor_id,asmen_id=excluded.asmen_id;
  update public.erp_groups set active=(mentor_id is not null and asmen_id is not null and (select count(*) from public.erp_group_members where group_id=g and active)=5) where id=g;
 else raise exception 'Permintaan pengelolaan tidak dikenali.'; end if;
 update public.erp_cohorts set revision=revision+1 where id=c;
 insert into public.erp_audit(cohort_id,actor_id,action,entity_id) values(c,auth.uid(),'Penempatan '||(p->>'action'),coalesce(u,g));
 return jsonb_build_object('ok',true);
end $$;

create function erp_private.attendance_command(action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c uuid; u uuid; eid uuid; e public.erp_attendance_events; a public.erp_attendance; old_status text; tok text; ids uuid[]; operator_name text; target uuid;
begin
 if not erp_private.session_valid() or not exists(select 1 from public.erp_profiles where id=auth.uid() and active) then raise exception 'Masuk kembali untuk melanjutkan.' using errcode='42501'; end if;
 if action in ('state','card') then
  c:=(p->>'cohort')::uuid; u:=coalesce(nullif(p->>'mentee','')::uuid,auth.uid());
  if not erp_private.attendance_operator(c) and not (erp_private.has_role('mentee') and u=auth.uid() and erp_private.attendance_subject(c,u)) then raise exception 'Kehadiran tidak dapat diakses.' using errcode='42501'; end if;
  if action='card' then
   if not erp_private.attendance_subject(c,u) then raise exception 'Mentee tidak aktif pada cohort ini.'; end if;
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
  if exists(select 1 from unnest(ids) x where not erp_private.attendance_subject(c,x)) then raise exception 'Peserta harus mentee aktif pada cohort yang sama.'; end if;
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
 if u is null or not erp_private.attendance_subject(e.cohort_id,u) or not exists(select 1 from public.erp_attendance_participants where event_id=eid and user_id=u) then raise exception 'Mentee tidak aktif atau bukan peserta kegiatan ini.'; end if;
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

create function public.erp_management_workspace(p_cohort uuid default null) returns jsonb language sql set search_path='' as $$select erp_private.management_workspace(p_cohort)$$;
create function public.erp_management_command(p_payload jsonb,p_expected integer) returns jsonb language sql set search_path='' as $$select erp_private.management_command(p_payload,p_expected)$$;
create function public.erp_attendance_command(p_action text,p_payload jsonb) returns jsonb language sql set search_path='' as $$select erp_private.attendance_command(p_action,p_payload)$$;
revoke all on function erp_private.attendance_operator(uuid),erp_private.attendance_subject(uuid,uuid),erp_private.management_workspace(uuid),erp_private.management_command(jsonb,integer),erp_private.attendance_command(text,jsonb),public.erp_management_workspace(uuid),public.erp_management_command(jsonb,integer),public.erp_attendance_command(text,jsonb) from public,anon;
grant execute on function erp_private.attendance_operator(uuid),erp_private.attendance_subject(uuid,uuid),erp_private.management_workspace(uuid),erp_private.management_command(jsonb,integer),erp_private.attendance_command(text,jsonb),public.erp_management_workspace(uuid),public.erp_management_command(jsonb,integer),public.erp_attendance_command(text,jsonb) to authenticated;
commit;
