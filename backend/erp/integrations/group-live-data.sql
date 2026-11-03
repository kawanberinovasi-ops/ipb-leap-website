-- Assigned staff may read their mentees while group placement is still in progress.
-- Existing staff_for() and all assessment write/publication rules remain unchanged.
begin;
create function erp_private.assigned_staff_for(c uuid,u uuid,r text) returns boolean language sql stable security definer set search_path='' as $$
 select r in ('asmen','mentor') and erp_private.has_role(r) and exists(
 select 1 from public.erp_groups g join public.erp_group_members m on m.group_id=g.id
 join public.erp_enrolments e on e.cohort_id=g.cohort_id and e.user_id=auth.uid() and e.role=r and e.active
 where g.cohort_id=c and m.user_id=u and m.active and ((r='asmen' and g.asmen_id=auth.uid()) or (r='mentor' and g.mentor_id=auth.uid())));
$$;
revoke all on function erp_private.assigned_staff_for(uuid,uuid,text) from public,anon,authenticated;
do $$
declare definition text;
begin
 definition:=pg_get_functiondef('erp_private.can_subject(uuid,uuid)'::regprocedure);
 if position('erp_private.staff_for' in definition)=0 then raise exception 'Unexpected subject access definition.';end if;
 execute replace(definition,'erp_private.staff_for','erp_private.assigned_staff_for');
 definition:=pg_get_functiondef('erp_private.record_bundle(uuid)'::regprocedure);
 execute replace(definition,'erp_private.staff_for','erp_private.assigned_staff_for');
end $$;

create table public.erp_group_session_logs (
 id uuid primary key,cohort_id uuid not null references public.erp_cohorts(id),group_id uuid not null references public.erp_groups(id),
 status text not null check(status in ('Draft','Tercatat')),data jsonb not null,
 revision integer not null default 1,created_by uuid not null references public.erp_profiles(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index erp_group_session_group on public.erp_group_session_logs(group_id,updated_at desc);
create index erp_group_session_cohort on public.erp_group_session_logs(cohort_id);
create index erp_group_session_author on public.erp_group_session_logs(created_by);
alter table public.erp_group_session_logs enable row level security;
create policy group_session_rpc_only on public.erp_group_session_logs for all to anon,authenticated using(false) with check(false);
revoke all on public.erp_group_session_logs from public,anon,authenticated;
create table public.erp_group_session_log_versions (
 log_id uuid not null references public.erp_group_session_logs(id),number integer not null,
 status text not null,data jsonb not null,actor_id uuid not null references public.erp_profiles(id),created_at timestamptz not null default now(),primary key(log_id,number)
);
alter table public.erp_group_session_log_versions enable row level security;
create policy group_session_versions_rpc_only on public.erp_group_session_log_versions for all to anon,authenticated using(false) with check(false);
revoke all on public.erp_group_session_log_versions from public,anon,authenticated;
create index erp_group_session_version_actor on public.erp_group_session_log_versions(actor_id);

create function erp_private.group_session_command(action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.erp_groups;old public.erp_group_session_logs;target uuid;d jsonb:=p->'data';participant jsonb;task jsonb;ids uuid[];u uuid;rev integer;stamp date;
begin
 if not erp_private.session_valid() then raise exception 'Masuk kembali untuk melanjutkan.' using errcode='42501';end if;
 select * into g from public.erp_groups where id=(p->>'group')::uuid;
 if g.id is null or not exists(select 1 from public.erp_enrolments e where e.cohort_id=g.cohort_id and e.user_id=auth.uid() and e.active and ((g.asmen_id=auth.uid() and e.role='asmen' and erp_private.has_role('asmen')) or (g.mentor_id=auth.uid() and e.role='mentor' and erp_private.has_role('mentor')))) then raise exception 'Sesi hanya dapat diakses pendamping yang ditugaskan.' using errcode='42501';end if;
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
end $$;
create function public.erp_group_session_command(p_action text,p_payload jsonb) returns jsonb language sql set search_path='' as $$select erp_private.group_session_command(p_action,p_payload)$$;
revoke all on function erp_private.group_session_command(text,jsonb),public.erp_group_session_command(text,jsonb) from public,anon,authenticated;
grant execute on function erp_private.group_session_command(text,jsonb),public.erp_group_session_command(text,jsonb) to authenticated;
commit;
