-- A group can be assigned before its roster is complete. Archiving is a separate state.
alter table public.erp_groups add column archived_at timestamptz;

CREATE OR REPLACE FUNCTION erp_private.management_command(p jsonb, expected integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c uuid:=(p->>'cohort')::uuid; u uuid:=(p->>'user')::uuid; g uuid; x uuid; r integer; selected uuid[]; person public.erp_profiles; e public.erp_enrolments; h public.erp_groups;
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
  if e.role='mentee' and not erp_private.enrolment_track_valid(p->>'field',p->>'pathway') then raise exception 'Pilih track peserta dan pathway yang sesuai bila sudah ditetapkan.'; end if;
  g:=nullif(p->>'group_id','')::uuid;
  if g is not null then
   select * into h from public.erp_groups where id=g and cohort_id=c and archived_at is null and field=p->>'field';
   if h.id is null or not erp_private.profile_assignable(u) then raise exception 'Kelompok dan track harus cocok; pilih akun yang terdaftar.'; end if;
   if exists(select 1 from public.erp_group_members m join public.erp_groups k on k.id=m.group_id where k.cohort_id=c and m.user_id=u and m.active and k.id<>g) then raise exception 'Mentee sudah berada dalam kelompok lain; lepaskan penempatan lama dahulu.'; end if;
   if not exists(select 1 from public.erp_group_members where group_id=g and user_id=u and active) and (select count(*) from public.erp_group_members where group_id=g and active)>=5 then raise exception 'Kelompok maksimal lima mentee.'; end if;
  end if;
  if e.role='mentee' and exists(select 1 from public.erp_group_members m join public.erp_groups k on k.id=m.group_id where k.cohort_id=c and m.user_id=u and m.active and k.field<>p->>'field') then raise exception 'Track kelompok harus tetap sesuai dengan mentee.'; end if;
  update public.erp_enrolments set field=case when role='mentee' then p->>'field' else field end,pathway=case when role='mentee' then p->>'pathway' else pathway end,active=(p->>'active')::boolean where cohort_id=c and user_id=u and role=e.role;
  if e.role='mentee' then
   update public.erp_group_members m set active=false,left_at=now() from public.erp_groups k where k.id=m.group_id and k.cohort_id=c and m.user_id=u and m.active and (not coalesce((p->>'active')::boolean,true) or g is null or m.group_id<>g);
   if g is not null and coalesce((p->>'active')::boolean,true) and not exists(select 1 from public.erp_group_members where group_id=g and user_id=u and active) then insert into public.erp_group_members(group_id,user_id) values(g,u); end if;

  end if;
 update public.erp_groups k set active=erp_private.group_ready(k.id) where k.cohort_id=c;
 elsif p->>'action'='group_archive' then
  g:=nullif(p->>'id','')::uuid;
  select * into h from public.erp_groups where id=g and cohort_id=c and archived_at is null for update;
  if not found then raise exception 'Kelompok aktif tidak ditemukan pada cohort ini.'; end if;
  update public.erp_group_members set active=false,left_at=now() where group_id=g and active;
  update public.erp_groups
   set active=false,archived_at=now(),mentor_id=null,asmen_id=null
   where id=g;
 elsif p->>'action'='group' then
  g:=coalesce(nullif(p->>'id','')::uuid,gen_random_uuid());
  if length(trim(p->>'name')) not between 2 and 100 or p->>'field' not in ('Entrepreneur / Business','Academic & Research','Professional / Corporate / Bureaucracy','Politics / Public Leadership','Social & Community / Social Impact') then raise exception 'Isi nama dan track kelompok.'; end if;
  if exists(select 1 from public.erp_groups where id=g and (cohort_id<>c or archived_at is not null)) then raise exception 'Kelompok tidak cocok.'; end if;
  foreach x in array array[nullif(p->>'mentor_id','')::uuid,nullif(p->>'asmen_id','')::uuid] loop
   if x is not null and not exists(select 1 from public.erp_enrolments z join public.erp_profiles a on a.id=z.user_id where z.cohort_id=c and z.user_id=x and z.active and erp_private.profile_assignable(a.id) and z.role=case when x=nullif(p->>'mentor_id','')::uuid then 'mentor' else 'asmen' end and z.role=any(a.roles)) then raise exception 'Pilih pendamping terdaftar dengan penugasan yang sesuai.'; end if;
  end loop;
  if nullif(p->>'mentor_id','')=nullif(p->>'asmen_id','') then raise exception 'Mentor dan Asmen harus berbeda.'; end if;
  if exists(select 1 from public.erp_groups k where k.cohort_id=c and k.id<>g and (k.mentor_id=nullif(p->>'mentor_id','')::uuid or k.asmen_id=nullif(p->>'asmen_id','')::uuid)) then raise exception 'Pendamping sudah ditugaskan pada kelompok lain.'; end if;
  if exists(select 1 from public.erp_group_members m join public.erp_enrolments z on z.user_id=m.user_id and z.cohort_id=c and z.role='mentee' where m.group_id=g and m.active and z.field<>p->>'field') then raise exception 'Track kelompok mengikuti track mentee.'; end if;
  insert into public.erp_groups(id,cohort_id,name,field,mentor_id,asmen_id) values(g,c,trim(p->>'name'),p->>'field',nullif(p->>'mentor_id','')::uuid,nullif(p->>'asmen_id','')::uuid) on conflict(id) do update set name=excluded.name,field=excluded.field,mentor_id=excluded.mentor_id,asmen_id=excluded.asmen_id;
  if p ? 'mentee_ids' then
   if jsonb_typeof(p->'mentee_ids') is distinct from 'array' then raise exception 'Pilih daftar mentee.'; end if;
   if jsonb_array_length(p->'mentee_ids')>5 then raise exception 'Kelompok maksimal lima mentee.'; end if;
   selected:=array(select value::uuid from jsonb_array_elements_text(p->'mentee_ids') as j(value));
   if cardinality(selected)<>(select count(distinct id) from unnest(selected) as members(id)) then
    raise exception 'Setiap mentee hanya boleh dipilih satu kali.';
   end if;
   if exists (
    select 1 from unnest(selected) as chosen(id)
    where not exists (
     select 1 from public.erp_enrolments enrolment
     where enrolment.user_id=chosen.id and enrolment.cohort_id=c and enrolment.role='mentee' and enrolment.active
      and enrolment.field=p->>'field' and erp_private.profile_assignable(enrolment.user_id)
    ) or exists (
     select 1 from public.erp_group_members m join public.erp_groups k on k.id=m.group_id
     where m.user_id=chosen.id and m.active and k.cohort_id=c and k.id<>g
    )
   ) then raise exception 'Pilih mentee terdaftar yang sesuai track dan belum memiliki kelompok lain.'; end if;
   insert into public.erp_group_members(group_id,user_id)
    select g,id from unnest(selected) as chosen(id)
    where not exists (select 1 from public.erp_group_members m where m.group_id=g and m.user_id=chosen.id and m.active);
   if (select count(*) from public.erp_group_members where group_id=g and active)>5 then
    raise exception 'Kelompok maksimal lima mentee.';
   end if;
  end if;
  update public.erp_groups k set active=erp_private.group_ready(k.id) where k.id=g;
 else raise exception 'Permintaan pengelolaan tidak dikenali.'; end if;
 update public.erp_cohorts set revision=revision+1 where id=c;
 if p->>'action'='group_archive' then
  insert into public.erp_audit(cohort_id,actor_id,action,entity_id,metadata)
   values(c,auth.uid(),'Mengarsipkan kelompok: '||h.name,g,
    jsonb_build_object('mentor_id',h.mentor_id,'asmen_id',h.asmen_id));
 else
  insert into public.erp_audit(cohort_id,actor_id,action,entity_id)
   values(c,auth.uid(),'Penempatan '||(p->>'action'),coalesce(u,g));
 end if;
 return jsonb_build_object('ok',true);
end $function$;

CREATE OR REPLACE FUNCTION erp_private.group_session_command(action text, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare g public.erp_groups;old public.erp_group_session_logs;target uuid;d jsonb:=p->'data';participant jsonb;task jsonb;ids uuid[];u uuid;rev integer;stamp date;
begin
 if not erp_private.session_valid() then raise exception 'Masuk kembali untuk melanjutkan.' using errcode='42501';end if;
 if action='save' then
  select * into g from public.erp_groups where id=(p->>'group')::uuid for share;
 else
  select * into g from public.erp_groups where id=(p->>'group')::uuid;
 end if;
 if g.id is null or g.archived_at is not null or not exists(select 1 from public.erp_enrolments e where e.cohort_id=g.cohort_id and e.user_id=auth.uid() and e.active and ((g.asmen_id=auth.uid() and e.role='asmen' and erp_private.has_role('asmen')) or (g.mentor_id=auth.uid() and e.role='mentor' and erp_private.has_role('mentor')))) then raise exception 'Sesi hanya dapat diakses pendamping yang ditugaskan.' using errcode='42501';end if;
 if action='state' then return jsonb_build_object('logs',coalesce((select jsonb_agg(to_jsonb(s) order by s.updated_at desc) from public.erp_group_session_logs s where s.group_id=g.id),'[]'::jsonb));end if;
 if action<>'save' then raise exception 'Permintaan sesi tidak dikenali.';end if;
 if p->>'status' not in ('Draft','Tercatat') or d is null or jsonb_typeof(d)<>'object' or length(d::text)>24000 then raise exception 'Isian sesi belum benar.';end if;
 if coalesce(d->>'kind','') not in ('group','one') or jsonb_typeof(d->'attendance') is distinct from 'array' or jsonb_typeof(d->'actions') is distinct from 'array' then raise exception 'Pilih jenis sesi dan peserta.';end if;
 if jsonb_array_length(d->'attendance') not between 1 and 5 or jsonb_array_length(d->'actions')>30 then raise exception 'Sesi memuat 1–5 mentee dan maksimal 30 tindak lanjut.';end if;
 if d->>'kind'='one' and jsonb_array_length(d->'attendance')<>1 then raise exception 'Pilih satu mentee untuk sesi 1-on-1.';end if;
 select array_agg((x->>'user_id')::uuid) into ids from jsonb_array_elements(d->'attendance') x;
 if (select count(distinct x) from unnest(ids)x)<>cardinality(ids) or exists(select 1 from unnest(ids)x where not exists(select 1 from public.erp_group_members m join public.erp_enrolments e on e.user_id=m.user_id and e.cohort_id=g.cohort_id and e.role='mentee' and e.active where m.group_id=g.id and m.active and m.user_id=x)) then raise exception 'Peserta harus mentee yang ditugaskan pada kelompok ini.';end if;
 for participant in select * from jsonb_array_elements(d->'attendance') loop
  if coalesce(participant->>'status','') not in ('','Hadir','Izin','Absen') or (p->>'status'='Tercatat' and coalesce(participant->>'status','')='') then raise exception 'Lengkapi kehadiran setiap peserta.';end if;
 end loop;
 if length(coalesce(d->>'topic',''))>500 or length(coalesce(d->>'theme',''))>500 or length(coalesce(d->>'summary',''))>8000 or coalesce(d->>'format','') not in ('','Online','Offline','Hybrid') then raise exception 'Detail sesi terlalu panjang atau format belum benar.';end if;
 if coalesce(d->>'date','')<>'' then stamp:=(d->>'date')::date;if stamp<(select starts_on from public.erp_cohorts where id=g.cohort_id) or stamp>(select ends_on from public.erp_cohorts where id=g.cohort_id) then raise exception 'Tanggal sesi harus berada dalam periode cohort.';end if;end if;
 if coalesce(d->>'duration','')<>'' and ((d->>'duration')::integer not between 1 and 720) then raise exception 'Durasi sesi harus 1–720 menit.';end if;
 if p->>'status'='Tercatat' and (coalesce(d->>'date','')='' or length(trim(coalesce(d->>'topic','')))=0 or length(trim(coalesce(d->>'summary','')))=0 or coalesce(d->>'duration','')='' or coalesce(d->>'format','')='') then raise exception 'Lengkapi tanggal, durasi, format, topik dan ringkasan sesi.';end if;
 for task in select * from jsonb_array_elements(d->'actions') loop
  if length(trim(coalesce(task->>'text',''))) not between 1 and 1000 then raise exception 'Lengkapi tindak lanjut.';end if;
  u:=nullif(task->>'who','')::uuid;if u is not null and not(u=any(ids)) then raise exception 'Tindak lanjut harus untuk peserta sesi ini.';end if;
  if coalesce(task->>'due','')<>'' then perform (task->>'due')::date;end if;
 end loop;
 foreach participant in array array[d->'photoUrl',d->'materialUrl'] loop
  if coalesce(participant#>>'{}','')<>'' and ((participant#>>'{}') !~ '^https?://' or length(participant#>>'{}')>2000) then raise exception 'Gunakan tautan dokumentasi yang benar.';end if;
 end loop;
 target:=(p->>'id')::uuid;perform pg_advisory_xact_lock(hashtext(target::text));select * into old from public.erp_group_session_logs where id=target for update;
 if old.id is not null then
  if old.group_id<>g.id then raise exception 'Sesi berasal dari kelompok lain.' using errcode='42501';end if;
  if old.data=d and old.status=p->>'status' then return jsonb_build_object('ok',true,'id',target,'revision',old.revision,'duplicate',true);end if;
  if old.revision is distinct from (p->>'expected')::integer then raise exception 'Data sesi berubah. Muat ulang sebelum menyimpan.' using errcode='40001';end if;
  if old.status='Tercatat' and p->>'status'='Draft' then raise exception 'Sesi tercatat tidak dikembalikan menjadi draft.';end if;
  update public.erp_group_session_logs set data=d,status=p->>'status',revision=revision+1,updated_at=now() where id=target returning revision into rev;
 else
  if coalesce((p->>'expected')::integer,0)<>0 then raise exception 'Sesi belum tersedia.';end if;
  insert into public.erp_group_session_logs(id,cohort_id,group_id,status,data,created_by)values(target,g.cohort_id,g.id,p->>'status',d,auth.uid()) returning revision into rev;
 end if;
 insert into public.erp_group_session_log_versions(log_id,number,status,data,actor_id)values(target,rev,p->>'status',d,auth.uid());
 insert into public.erp_audit(cohort_id,actor_id,action,entity_id)values(g.cohort_id,auth.uid(),'Menyimpan sesi mentoring',target);
 return jsonb_build_object('ok',true,'id',target,'revision',rev);
end $function$;
