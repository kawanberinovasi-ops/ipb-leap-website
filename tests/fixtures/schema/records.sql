create table erp_private.subject_revisions(cohort_id uuid references public.erp_cohorts(id),mentee_id uuid references public.erp_profiles(id),revision int not null default 0,primary key(cohort_id,mentee_id));
create table erp_private.requests(request_id uuid primary key,actor_id uuid not null,request_hash text not null,result jsonb not null,created_at timestamptz not null default now());
alter table erp_private.subject_revisions enable row level security;
alter table erp_private.requests enable row level security;
create function erp_private.commit_records(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=(p->>'actor')::uuid; sid uuid:=(p->>'session')::uuid;c uuid:=(p->>'cohort')::uuid;mentee uuid:=(p->>'mentee')::uuid; request uuid:=(p->>'request')::uuid;cached erp_private.requests; revision int; co_revision int; action text:=p->>'action';o jsonb;r public.erp_records;v public.erp_versions;is_self boolean;is_asmen boolean;is_mentor boolean;is_assessor boolean;version_id uuid; n int;target uuid; result jsonb;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Akses layanan ditolak.' using errcode='42501'; end if;
 if not exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id join public.erp_profiles a on a.id=u.id where s.id=sid and u.id=actor and u.email_confirmed_at is not null and a.active and (s.not_after is null or s.not_after>now())) then raise exception 'Sesi akun berakhir.' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtext(request::text));
 select * into cached from erp_private.requests where request_id=request;
 if cached.request_id is not null then
  if cached.actor_id<>actor or cached.request_hash<>p->>'hash' then raise exception 'ID permintaan telah digunakan.'; end if;return cached.result;
 end if;
 select h.revision into co_revision from public.erp_cohorts h where h.id=c for update;
 if co_revision is distinct from (p->>'cohortRevision')::int then raise exception 'Penugasan berubah. Muat ulang halaman.' using errcode='40001'; end if;
 perform pg_advisory_xact_lock(hashtext(c::text||mentee::text));
 insert into erp_private.subject_revisions(cohort_id,mentee_id) values(c,mentee) on conflict do nothing;
 select s.revision into revision from erp_private.subject_revisions s where s.cohort_id=c and s.mentee_id=mentee for update;
 if revision is distinct from (p->>'revision')::int then raise exception 'Catatan berubah. Muat ulang agar versi terbaru terbaca.' using errcode='40001'; end if;
 -- Helper akses menggunakan sesi pengguna asli; role layanan tetap diperiksa sebelum mengganti claims.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'session_id',sid,'role','authenticated')::text,true);
 is_self:=actor=mentee and erp_private.has_role('mentee') and erp_private.can_subject(c,mentee);
 is_asmen:=erp_private.staff_for(c,mentee,'asmen');is_mentor:=erp_private.staff_for(c,mentee,'mentor');is_assessor:=erp_private.assesses(c);
 if not erp_private.can_subject(c,mentee) then raise exception 'Tidak ditugaskan mendampingi mentee ini.' using errcode='42501'; end if;
 if action in ('save','submit') and not is_self then raise exception 'Hanya mentee yang dapat menulis jawabannya.' using errcode='42501'; end if;
 if action in ('abc_check','commitment','process','evidence') and not is_asmen then raise exception 'Pemeriksaan ini merupakan tugas Asmen.' using errcode='42501'; end if;
 if action in ('poc_decide','mentoring_check') and not is_mentor then raise exception 'Pemeriksaan ini merupakan tugas Mentor.' using errcode='42501'; end if;
 if action not in ('save','submit','abc_check','commitment','process','evidence','poc_decide','mentoring_check','review_save','publish') then raise exception 'Tindakan tidak dikenali.'; end if;
 if jsonb_array_length(p->'operations')<>1 then raise exception 'Simpan satu catatan setiap permintaan.'; end if;
 for o in select value from jsonb_array_elements(p->'operations') loop
  target:=(o->>'id')::uuid;
  select * into r from public.erp_records where id=target for update;
  if r.id is null then
   if action not in ('save','submit','review_save','publish') then raise exception 'Catatan belum dibuat.'; end if;
   insert into public.erp_records(id,cohort_id,mentee_id,kind,month_no,session_id) values(target,c,mentee,o->>'kind',(o->>'month')::int,nullif(o->>'session','')::uuid) returning * into r;
  end if;
  if r.cohort_id<>c or r.mentee_id<>mentee or r.kind<>o->>'kind' or r.month_no<>(o->>'month')::int then raise exception 'Referensi catatan tidak cocok.'; end if;
  select * into v from public.erp_versions where record_id=r.id order by number desc limit 1;
  if r.kind='review' then
   if (r.month_no=12 and not is_assessor) or (r.month_no<>12 and not is_mentor) then raise exception 'Penilai periode ini tidak sesuai penugasan.' using errcode='42501'; end if;
   if r.month_no not in (3,6,9,12) or action not in ('review_save','publish') then raise exception 'Periode penilaian tidak sesuai.'; end if;
  elsif action in ('review_save','publish') then raise exception 'Gunakan catatan penilaian.';
  end if;
  if action in ('save','submit') and r.kind='review' then raise exception 'Mentee tidak menilai dirinya sendiri.'; end if;
  if action in ('abc_check','poc_decide','mentoring_check') then
   if (action='abc_check' and r.kind<>'abc') or (action='poc_decide' and r.kind<>'poc') or (action='mentoring_check' and r.kind<>'mentoring') or v.status<>'Diajukan' then raise exception 'Ajukan catatan lebih dahulu.'; end if;
   if o->'data' is distinct from v.data then raise exception 'Pemeriksa tidak dapat mengubah jawaban mentee.'; end if;
  end if;
  if action in ('commitment','process','evidence') and (v.id is null or v.status='Draft') then raise exception 'Catatan belum diajukan.'; end if;
  if o ? 'check' then
   if (o->'check'->>'source')::uuid is distinct from v.id then raise exception 'Versi pemeriksaan sudah berubah.'; end if;
   if (action='commitment' and r.kind<>'abc') or (action='process' and r.kind<>'checkin') or (action='evidence' and r.kind<>'actual') then raise exception 'Jenis pemeriksaan tidak sesuai.'; end if;
   insert into public.erp_checks(record_id,source_version_id,kind,data,actor_id) values(r.id,v.id,o->'check'->>'kind',o->'check'->'data',actor);
  end if;
  if o ? 'status' then
   if action='save' and o->>'status'<>'Draft' or action='submit' and o->>'status'<>'Diajukan' or action='review_save' and o->>'status'<>'Draft' or action='publish' and o->>'status'<>'Diterbitkan' then raise exception 'Status penyimpanan tidak sesuai.'; end if;
   if action='abc_check' and o->>'status' not in ('Sudah diperiksa','Perlu perbaikan') or action='poc_decide' and o->>'status' not in ('Disepakati','Perlu perbaikan') or action='mentoring_check' and o->>'status' not in ('Sudah diperiksa','Perlu perbaikan') then raise exception 'Status pemeriksaan tidak sesuai.'; end if;
   update public.erp_records set latest_version=latest_version+1,updated_at=now() where id=r.id returning latest_version into n;
   insert into public.erp_versions(record_id,number,status,data,actor_id,action) values(r.id,n,o->>'status',o->'data',actor,action) returning id into version_id;
   if action='publish' then
    if jsonb_typeof(o->'score'->'total')<>'number' or (o->'score'->>'total')::numeric not between 0 and 100 then raise exception 'Nilai belum lengkap.'; end if;
    insert into public.erp_publications(record_id,version_id,number,score,sources,actor_id) values(r.id,version_id,n,o->'score',o->'sources',actor);
   end if;
  end if;
 end loop;
 update erp_private.subject_revisions s set revision=s.revision+1 where s.cohort_id=c and s.mentee_id=mentee;
 insert into public.erp_audit(cohort_id,actor_id,action,entity_id) values(c,actor,action,target);
 result:=jsonb_build_object('ok',true,'id',target,'version',version_id,'revision',revision+1);
 insert into erp_private.requests values(request,actor,p->>'hash',result,now());return result;
end;
$$;
create function public.erp_commit_records(p jsonb) returns jsonb language sql security invoker set search_path='' as $$select erp_private.commit_records(p)$$;
revoke all on function public.erp_commit_records(jsonb),erp_private.commit_records(jsonb) from public,anon,authenticated;
grant execute on function public.erp_commit_records(jsonb),erp_private.commit_records(jsonb) to service_role;
create function erp_private.subject_revision(p_cohort uuid,p_mentee uuid) returns int language plpgsql stable security definer set search_path='' as $$
begin
 if not erp_private.can_subject(p_cohort,p_mentee) then raise exception 'Mentee tidak dapat diakses.' using errcode='42501'; end if;
 return coalesce((select revision from erp_private.subject_revisions where cohort_id=p_cohort and mentee_id=p_mentee),0);
end;$$;
create function public.erp_revision(p_cohort uuid,p_mentee uuid) returns int language sql security invoker set search_path='' as $$select erp_private.subject_revision(p_cohort,p_mentee)$$;
revoke all on function public.erp_revision(uuid,uuid),erp_private.subject_revision(uuid,uuid) from public,anon;
grant execute on function public.erp_revision(uuid,uuid),erp_private.subject_revision(uuid,uuid) to authenticated;
