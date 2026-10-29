-- REVIEW ONLY: additive candidate, NOT applied to the active database.
-- Policy defaults to disabled. No observer count, relationship or anonymity is assumed.
begin;
create table public.erp_360_policies(
 cohort_id uuid primary key references public.erp_cohorts(id),
 enabled boolean not null default false,
 relationships text[], maximum_observers integer,
 anonymous boolean, decision_note text, revision integer not null default 0,
 actor_id uuid not null references public.erp_profiles(id), updated_at timestamptz not null default now(),
 check (not enabled or (cardinality(relationships)>0 and maximum_observers>0 and anonymous is not null and length(trim(decision_note))>0) is true)
);
create table public.erp_360_assignments(
 id uuid primary key default gen_random_uuid(),cohort_id uuid not null references public.erp_cohorts(id),
 mentee_id uuid not null references public.erp_profiles(id),observer_id uuid not null references public.erp_profiles(id),
 period integer not null check(period in (6,12)),relationship text not null,
 active boolean not null default true,revision integer not null default 0,
 created_by uuid not null references public.erp_profiles(id),created_at timestamptz not null default now(),
 unique(cohort_id,mentee_id,period,observer_id),check(observer_id<>mentee_id)
);
create table public.erp_360_versions(
 id uuid primary key default gen_random_uuid(),assignment_id uuid not null references public.erp_360_assignments(id),
 number integer not null,status text not null check(status in ('Draft','Diajukan','Perlu perbaikan')),
 data jsonb not null,actor_id uuid not null references public.erp_profiles(id),created_at timestamptz not null default now(),
 unique(assignment_id,number)
);
create table public.erp_360_events(
 id uuid primary key default gen_random_uuid(),cohort_id uuid not null references public.erp_cohorts(id),
 assignment_id uuid references public.erp_360_assignments(id),action text not null,
 actor_id uuid not null references public.erp_profiles(id),detail jsonb not null,created_at timestamptz not null default now()
);
alter table public.erp_360_policies enable row level security;
alter table public.erp_360_assignments enable row level security;
alter table public.erp_360_versions enable row level security;
alter table public.erp_360_events enable row level security;
-- There is no direct client table access. Private functions below are the authorization boundary.
revoke all on public.erp_360_policies,public.erp_360_assignments,public.erp_360_versions,public.erp_360_events from public,anon,authenticated;
create function erp_private.observer_workspace(c uuid,m uuid,period_no int) returns jsonb
language plpgsql security definer set search_path='' as $$
declare policy public.erp_360_policies; manages boolean; decides boolean; tasks jsonb; feedback jsonb;
begin
 if not erp_private.session_valid() or not exists(select 1 from public.erp_profiles where id=auth.uid() and active) then raise exception 'Sesi akun berakhir.' using errcode='42501';end if;
 manages:=erp_private.manages(c);
 decides:=case when period_no=6 then erp_private.staff_for(c,m,'mentor') when period_no=12 then erp_private.assesses(c) else false end;
 select * into policy from public.erp_360_policies where cohort_id=c;
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'cohort',a.cohort_id,'mentee',a.mentee_id,'period',a.period,'relationship',a.relationship,'active',a.active,'revision',a.revision,
 'observer',case when manages or a.observer_id=auth.uid() then a.observer_id else null end,
 'events',case when a.observer_id=auth.uid() then(select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at),'[]'::jsonb)from public.erp_360_events e where e.assignment_id=a.id)else '[]'::jsonb end,
 'versions',case when a.observer_id=auth.uid() then (select coalesce(jsonb_agg(to_jsonb(v) order by v.number),'[]'::jsonb) from public.erp_360_versions v where v.assignment_id=a.id) else '[]'::jsonb end) order by a.created_at),'[]'::jsonb)
 into tasks from public.erp_360_assignments a
 where (a.observer_id=auth.uid() or (manages and a.cohort_id=c)) and (c is null or a.cohort_id=c);
 select coalesce(jsonb_agg(jsonb_build_object('assignment',a.id,'relationship',a.relationship,
 'observer',case when policy.anonymous then null else a.observer_id end,'version',v.id,'number',v.number,'created_at',v.created_at,'revision',a.revision,'data',v.data)),'[]'::jsonb)
 into feedback from public.erp_360_assignments a join lateral(select * from public.erp_360_versions v where v.assignment_id=a.id order by v.number desc limit 1)v on true
 where decides and policy.enabled and a.active and a.cohort_id=c and a.mentee_id=m and a.period=period_no and v.status='Diajukan';
 return jsonb_build_object('policy',case when manages then to_jsonb(policy) else jsonb_build_object('enabled',coalesce(policy.enabled,false),'anonymous',policy.anonymous) end,
 'canManage',manages,'canDecide',decides,'tasks',tasks,'feedback',feedback);
end;$$;
create function public.erp_360_workspace(p_cohort uuid default null,p_mentee uuid default null,p_period int default 6) returns jsonb
language sql security invoker set search_path='' as $$select erp_private.observer_workspace(p_cohort,p_mentee,p_period)$$;
create function erp_private.observer_command(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c uuid:=(p->>'cohort')::uuid; m uuid:=(p->>'mentee')::uuid; a public.erp_360_assignments; policy public.erp_360_policies;
 action text:=p->>'action';d jsonb:=p->'data';v public.erp_360_versions;item jsonb;target uuid;period_no int;rel text;
begin
 if not erp_private.session_valid() or not exists(select 1 from public.erp_profiles where id=auth.uid() and active) then raise exception 'Sesi akun berakhir.' using errcode='42501';end if;
 -- Lock matches assessment commit's cohort lock: source validation and publication are atomic.
 perform 1 from public.erp_cohorts where id=c for update;
 if not found then raise exception 'Cohort tidak ditemukan.';end if;
 select * into policy from public.erp_360_policies where cohort_id=c for update;
 if action='policy' then
  if not erp_private.manages(c) then raise exception 'Tidak berwenang mengelola 360.' using errcode='42501';end if;
  if (p->>'expected') is null or coalesce(policy.revision,0)<>(p->>'expected')::int then raise exception 'Kebijakan berubah. Muat ulang; isian belum tersimpan.' using errcode='40001';end if;
  if nullif(trim(d->>'decision_note'),'') is null then raise exception 'Catat keputusan kebijakan.';end if;
  if jsonb_typeof(d->'anonymous') is distinct from 'boolean' or jsonb_typeof(d->'relationships') is distinct from 'array' or jsonb_array_length(d->'relationships')<1 or nullif(d->>'maximum_observers','') is null or (d->>'maximum_observers')::int<1 then raise exception 'Tetapkan jenis/jumlah pengamat dan anonimitas secara eksplisit.';end if;
  if exists(select 1 from public.erp_360_assignments where cohort_id=c) and (policy.relationships is distinct from array(select jsonb_array_elements_text(d->'relationships')) or policy.anonymous is distinct from (d->>'anonymous')::boolean or policy.maximum_observers is distinct from (d->>'maximum_observers')::int) then raise exception 'Kebijakan sudah dipakai. Perubahan kerahasiaan memerlukan rencana migrasi terpisah.';end if;
  insert into public.erp_360_policies(cohort_id,enabled,relationships,maximum_observers,anonymous,decision_note,revision,actor_id)
  values(c,coalesce((d->>'enabled')::boolean,false),array(select jsonb_array_elements_text(d->'relationships')),(d->>'maximum_observers')::int,(d->>'anonymous')::boolean,d->>'decision_note',1,auth.uid())
  on conflict(cohort_id)do update set enabled=excluded.enabled,relationships=excluded.relationships,maximum_observers=excluded.maximum_observers,anonymous=excluded.anonymous,decision_note=excluded.decision_note,revision=erp_360_policies.revision+1,actor_id=auth.uid(),updated_at=now();
 elsif action='assign' then
  if not erp_private.manages(c) then raise exception 'Tidak berwenang memberi tugas 360.' using errcode='42501';end if;
  if not coalesce(policy.enabled,false) then raise exception 'Kebijakan 360 belum diaktifkan.';end if;
  period_no:=(p->>'period')::int;target:=(d->>'observer')::uuid;rel:=d->>'relationship';
  if period_no not in (6,12) or not rel=any(policy.relationships) then raise exception 'Periode atau hubungan tidak sesuai kebijakan.';end if;
  if target=m or not exists(select 1 from public.erp_profiles where id=target and active) or not exists(select 1 from public.erp_enrolments where cohort_id=c and user_id=m and role='mentee' and active)then raise exception 'Pengamat atau mentee tidak sah.';end if;
  if(select count(*) from public.erp_360_assignments where cohort_id=c and mentee_id=m and period=period_no and active)>=policy.maximum_observers then raise exception 'Batas jumlah pengamat sudah tercapai.';end if;
  insert into public.erp_360_assignments(cohort_id,mentee_id,observer_id,period,relationship,created_by)values(c,m,target,period_no,rel,auth.uid())returning * into a;
 elsif action in ('save','submit','repair','deactivate') then
  select * into a from public.erp_360_assignments where id=(p->>'id')::uuid and cohort_id=c for update;
  if a.id is null or not a.active then raise exception 'Tugas tidak tersedia.';end if;
  if (p->>'expected') is null or a.revision<>(p->>'expected')::int then raise exception 'Masukan berubah. Muat ulang; isian tetap tersedia.' using errcode='40001';end if;
  if action='deactivate' then
   if not erp_private.manages(c) then raise exception 'Akses ditolak.' using errcode='42501';end if;
   update public.erp_360_assignments set active=false,revision=revision+1 where id=a.id;
  else
   if action='repair' then
    if not(case when a.period=6 then erp_private.staff_for(c,a.mentee_id,'mentor') else erp_private.assesses(c) end)then raise exception 'Hanya penilai berwenang meminta perbaikan.' using errcode='42501';end if;
    select * into v from public.erp_360_versions where assignment_id=a.id order by number desc limit 1;
    if v.status is distinct from 'Diajukan' or nullif(trim(d->>'note'),'')is null then raise exception 'Pilih masukan diajukan dan tulis alasan.';end if;
    d:=v.data; -- A reviewer cannot edit observer answers.
   else
    if a.observer_id<>auth.uid() then raise exception 'Hanya pengamat yang ditugaskan mengisi masukan.' using errcode='42501';end if;
    if not coalesce(policy.enabled,false) then raise exception 'Pengumpulan 360 belum diaktifkan.';end if;
    if action='submit' then
     if jsonb_typeof(d->'competencies')is distinct from 'array' or jsonb_array_length(d->'competencies')<>6 then raise exception 'Lengkapi enam kompetensi.';end if;
     for item in select value from jsonb_array_elements(d->'competencies') loop
      if jsonb_typeof(item->'observed')is distinct from 'boolean' then raise exception 'Nyatakan cukup/belum cukup mengamati.';end if;
      if(item->>'observed')::boolean and (nullif(trim(item->>'behavior'),'')is null or nullif(trim(item->>'proof'),'')is null)then raise exception 'Tulis perilaku dan bukti yang diamati.';end if;
      if not(item->>'observed')::boolean and item->>'level' is not null and item->>'level'<>'' then raise exception 'Belum mengamati tidak memiliki level.';end if;
      if nullif(item->>'level','')is not null and (item->>'level')not in ('1','2','3','4')then raise exception 'Level usulan harus 1–4 atau kosong.';end if;
     end loop;
    end if;
   end if;
   if length(d::text)>90000 then raise exception 'Masukan terlalu panjang.';end if;
   insert into public.erp_360_versions(assignment_id,number,status,data,actor_id)values(a.id,a.revision+1,case when action='repair'then 'Perlu perbaikan'when action='submit'then 'Diajukan'else 'Draft'end,d,auth.uid());
   update public.erp_360_assignments set revision=revision+1 where id=a.id;
  end if;
 else raise exception 'Tindakan tidak dikenali.';end if;
 insert into public.erp_360_events(cohort_id,assignment_id,action,actor_id,detail)values(c,a.id,action,auth.uid(),case when action='repair'then jsonb_build_object('note',p->'data'->>'note')when action='policy'then d else '{}'::jsonb end);
 return jsonb_build_object('ok',true,'id',a.id);
end;$$;
create function public.erp_360_command(p jsonb)returns jsonb language sql security invoker set search_path='' as $$select erp_private.observer_command(p)$$;
-- Called inside the existing transaction AFTER cohort lock and assignment checks.
create function erp_private.observer_sources(c uuid,m uuid,period_no int,refs jsonb)returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; n int;
begin
 if not erp_private.session_valid() or not(case when period_no=6 then erp_private.staff_for(c,m,'mentor') when period_no=12 then erp_private.assesses(c) else false end)then
  if refs='[]'::jsonb then return '[]'::jsonb;end if;raise exception 'Akses sumber 360 ditolak.' using errcode='42501';end if;
 if jsonb_typeof(refs)is distinct from 'array' then raise exception 'Referensi 360 tidak sah.';end if;
 if jsonb_array_length(refs)<>(select count(distinct value)from jsonb_array_elements_text(refs))then raise exception 'Referensi 360 tidak boleh dihitung dua kali.';end if;
 select count(*),coalesce(jsonb_agg(jsonb_build_object('version',v.id,'assignment',a.id,'number',v.number,'created_at',v.created_at)),'[]'::jsonb)into n,result
 from public.erp_360_assignments a join public.erp_360_policies policy on policy.cohort_id=a.cohort_id and policy.enabled
 join lateral(select * from public.erp_360_versions where assignment_id=a.id order by number desc limit 1)v on true
 where a.cohort_id=c and a.mentee_id=m and a.period=period_no and a.active and v.status='Diajukan'and refs ? v.id::text;
 if n<>jsonb_array_length(refs)then raise exception 'Sumber 360 berubah atau tidak diizinkan. Periksa ulang.' using errcode='40001';end if;
 return result;
end;$$;
-- Guarded extension: no recreation/reset of existing records or calculation policy.
do $patch$
declare definition text;needle text:='insert into public.erp_publications(record_id,version_id,number,score,sources,actor_id) values(r.id,version_id,n,o->''score'',o->''sources'',actor);';
begin
 definition:=pg_get_functiondef('erp_private.commit_records(jsonb)'::regprocedure);
 if position(needle in definition)=0 then raise exception 'Versi commit_records berbeda; tinjau patch sebelum menerapkan.';end if;
 definition:=replace(definition,needle,'o:=jsonb_set(o,''{sources,observers}'',erp_private.observer_sources(c,mentee,r.month_no,coalesce(o->''data''->''observerRefs'',''[]''::jsonb)));'||chr(10)||needle);
 execute definition;
end;$patch$;
revoke all on function public.erp_360_workspace(uuid,uuid,int),erp_private.observer_workspace(uuid,uuid,int),public.erp_360_command(jsonb),erp_private.observer_command(jsonb),erp_private.observer_sources(uuid,uuid,int,jsonb)from public,anon;
grant execute on function public.erp_360_workspace(uuid,uuid,int),erp_private.observer_workspace(uuid,uuid,int),public.erp_360_command(jsonb),erp_private.observer_command(jsonb)to authenticated;
revoke all on function erp_private.observer_sources(uuid,uuid,int,jsonb)from authenticated;
commit;
