-- GROW uses existing identities, cohort enrolments, and assigned staff. No participant seed.
create table erp_private.grow_workspaces (
 cohort_id uuid not null references public.erp_cohorts(id),
 mentee_id uuid not null references public.erp_profiles(id),
 revision integer not null default 0,
 state jsonb not null,
 updated_at timestamptz not null default now(),
 primary key(cohort_id,mentee_id),
 check(jsonb_typeof(state)='object' and octet_length(state::text)<=10485760)
);
create index grow_workspaces_subject on erp_private.grow_workspaces(mentee_id,cohort_id);
alter table erp_private.grow_workspaces enable row level security;
create policy grow_rpc_only on erp_private.grow_workspaces for all to anon,authenticated using(false) with check(false);
revoke all on erp_private.grow_workspaces from public,anon,authenticated;
create table erp_private.grow_events (
 id bigint generated always as identity primary key,
 cohort_id uuid not null references public.erp_cohorts(id),
 mentee_id uuid not null references public.erp_profiles(id),
 actor_id uuid not null references public.erp_profiles(id),
 action text not null,revision integer not null,
 snapshot jsonb not null,created_at timestamptz not null default now()
);
create index grow_events_subject on erp_private.grow_events(cohort_id,mentee_id,revision desc);
create index grow_events_actor on erp_private.grow_events(actor_id);
create index grow_events_mentee on erp_private.grow_events(mentee_id);
alter table erp_private.grow_events enable row level security;
create policy grow_events_rpc_only on erp_private.grow_events for all to anon,authenticated using(false) with check(false);
revoke all on erp_private.grow_events from public,anon,authenticated;

create function erp_private.grow_initial() returns jsonb language sql immutable set search_path='' as $$
 select '{"canvas":null,"canvasHistory":[],"notes":[],"sessions":[],"reviews":{},"publications":[],"supportReplies":{}}'::jsonb
$$;
create function erp_private.grow_track(field text) returns text language sql immutable set search_path='' as $$
 select case field when 'Entrepreneur / Business' then 'business' when 'Professional / Corporate / Bureaucracy' then 'professional' when 'Academic & Research' then 'academic' when 'Politics / Public Leadership' then 'public' when 'Social & Community / Social Impact' then 'social' else null end
$$;
create function erp_private.grow_catalog(t text) returns jsonb language sql immutable set search_path='' as $$ select x from jsonb_array_elements($catalog$[{"id": "business", "track": "Entrepreneur / Business", "label": "Entrepreneur", "northStar": "Rp500 juta Cumulative Annual Revenue", "kpis": [{"id": "businessLegal", "label": "1 entitas usaha legal terdaftar (CV / PT / UD / Koperasi)", "unit": "entitas", "target": 1}, {"id": "businessClients", "label": "Min. 10 klien/pelanggan berbayar terdokumentasi", "unit": "klien/pelanggan", "target": 10}, {"id": "businessRevenue", "label": "Min. Rp 50 juta rata-rata revenue/bulan di bulan ke-12", "unit": "rupiah per bulan", "target": 50000000}]}, {"id": "professional", "track": "Professional / Corporate / Bureaucracy", "label": "Professional / Industri", "northStar": "1 Career Breakthrough", "kpis": [{"id": "professionalInternship", "label": "Min. 6 bulan magang aktif terdokumentasi", "unit": "bulan", "target": 6}, {"id": "professionalContract", "label": "1 kontrak kerja full-time diterima sebelum akhir periode", "unit": "kontrak", "target": 1}, {"id": "professionalReferences", "label": "Min. 2 rekomendasi profesional dari atasan/supervisor", "unit": "rekomendasi", "target": 2}]}, {"id": "academic", "track": "Academic & Research", "label": "Akademisi & Riset", "northStar": "1 Academic Breakthrough", "kpis": [{"id": "academicJournal", "label": "Min. 1 publikasi jurnal terindeks (Sinta 2–4 atau setara)", "unit": "publikasi", "target": 1}, {"id": "academicArticles", "label": "Min. 5 artikel populer di platform publik (min. 1.000 pembaca)", "unit": "artikel", "target": 5, "note": "Cakupan hitungan 1.000 pembaca perlu dijelaskan bersama Mentor pada cara ukur."}, {"id": "academicLoa", "label": "1 Letter of Acceptance studi lanjut / beasiswa / program riset", "unit": "Letter of Acceptance", "target": 1}]}, {"id": "public", "track": "Politics / Public Leadership", "label": "Birokrasi & Politik", "northStar": "1 Political Breakthrough", "kpis": [{"id": "publicCommunity", "label": "1 gerakan/komunitas dengan min. 200 anggota aktif terdokumentasi", "unit": "gerakan/komunitas", "target": 1}, {"id": "publicRole", "label": "1 posisi atau peran resmi di instansi / lembaga / partai terkait", "unit": "posisi/peran", "target": 1}, {"id": "publicPolicy", "label": "1 usulan kebijakan/program terdokumentasi & sudah diajukan", "unit": "usulan", "target": 1}]}, {"id": "social", "track": "Social & Community / Social Impact", "label": "Sosial & Komunitas", "northStar": "1 Sustainable Impact", "kpis": [{"id": "socialLegal", "label": "1 entitas legal terdaftar (yayasan / komunitas / organisasi)", "unit": "entitas", "target": 1}, {"id": "socialPrograms", "label": "Min. 5 program/kegiatan terlaksana selama periode", "unit": "program/kegiatan", "target": 5}, {"id": "socialBeneficiaries", "label": "Min. 500 penerima manfaat langsung terverifikasi", "unit": "penerima manfaat", "target": 500}, {"id": "socialFunding", "label": "1 sumber pendanaan eksternal berhasil digalang", "unit": "sumber pendanaan", "target": 1}]}]$catalog$::jsonb) x where x->>'id'=t $$;
create function erp_private.grow_need(v jsonb,label text) returns void language plpgsql immutable set search_path='' as $$
begin
 if jsonb_typeof(v) is distinct from 'string' or length(trim(v#>>'{}')) not between 1 and 10000 then raise exception 'Lengkapi % (maksimal 10.000 karakter).',label;end if;
end $$;
create function erp_private.grow_url(v text) returns void language plpgsql immutable set search_path='' as $$
begin if coalesce(v,'')<>'' and (length(v)>2000 or v !~ '^https?://[^/[:space:]]+([/][^[:space:]]*)?$') then raise exception 'Tautan bukti harus berupa alamat http atau https yang benar.';end if;end $$;
create function erp_private.grow_month(c uuid,d date) returns integer language plpgsql stable set search_path='' as $$
declare starts date;ends date;m integer;
begin
 select starts_on,ends_on into starts,ends from public.erp_cohorts where id=c;
 if d is null or starts is null or d<starts or d>ends then raise exception 'Tanggal harus berada dalam periode cohort.';end if;
 m:=(extract(year from d)::int-extract(year from starts)::int)*12+extract(month from d)::int-extract(month from starts)::int+1;
 if m not between 1 and 12 then raise exception 'Tanggal di luar 12 bulan program.';end if;return m;
end $$;
create function erp_private.grow_access(c uuid,u uuid,r text) returns text language plpgsql stable security definer set search_path='' as $$
begin
 if not erp_private.session_valid() or not exists(select 1 from public.erp_cohorts where id=c and active) or not exists(select 1 from public.erp_enrolments e join public.erp_profiles p on p.id=e.user_id where e.cohort_id=c and e.user_id=u and e.role='mentee' and e.active and p.active and 'mentee'=any(p.roles)) then raise exception 'Akun atau penugasan mentee tidak tersedia.' using errcode='42501';end if;
 if r='mentee' and auth.uid()=u and erp_private.has_role('mentee') then return r;end if;
 if r in ('asmen','mentor') and erp_private.assigned_staff_for(c,u,r) then return r;end if;
 if r='program' and erp_private.assesses(c) then return r;end if;
 raise exception 'Tindakan hanya tersedia sesuai penugasan akun.' using errcode='42501';
end $$;
create function erp_private.grow_sources(s jsonb,p integer) returns text language sql immutable set search_path='' as $$
 select md5(coalesce((select jsonb_agg(n order by ord) from jsonb_array_elements(s->'notes') with ordinality x(n,ord) where n->>'status'='Diajukan' and (n->>'period')::int=p),'[]'::jsonb)::text)
$$;
create function erp_private.grow_score(s jsonb,p integer,today date) returns jsonb language plpgsql immutable set search_path='' as $$
declare n jsonb;notes integer:=0;eligible integer:=0;checked integer:=0;points numeric:=0;asmen numeric;mentor numeric;r jsonb:=s->'reviews'->p::text;
begin
 for n in select value from jsonb_array_elements(s->'notes') where value->>'status'='Diajukan' and (value->>'period')::int=p loop
  notes:=notes+1;
  if n#>>'{outcome,status}'='Selesai' or (n#>>'{data,due}')::date<today then
   eligible:=eligible+1;
   if n->'check' is not null and (n#>>'{check,outcomeRevision}')::int=coalesce((n->>'outcomeRevision')::int,0) then
    checked:=checked+1;points:=points+(n#>>'{check,data,execution}')::numeric+(n#>>'{check,data,timeliness}')::numeric+(n#>>'{check,data,evidence}')::numeric;
   end if;
  end if;
 end loop;
 if checked>0 and checked=eligible then asmen:=round(points/checked,2);end if;
 if r is not null and r<>'null'::jsonb and r->>'canvasVersion'=s#>>'{canvas,version}' and r->>'sources'=erp_private.grow_sources(s,p) then select round(avg((x->>'level')::numeric)*0.7,2) into mentor from jsonb_array_elements(r->'items') x;end if;
 return jsonb_build_object('asmen',asmen,'mentor',mentor,'total',asmen+mentor,'eligible',eligible,'checked',checked,'waiting',notes-eligible);
end $$;
create function erp_private.grow_state(c uuid,u uuid,r text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s jsonb;rev integer:=0;field text;t text;scores jsonb:='{}';p integer;pub jsonb;logs jsonb;
begin
 perform erp_private.grow_access(c,u,r);
 select state,revision into s,rev from erp_private.grow_workspaces where cohort_id=c and mentee_id=u;
 s:=coalesce(s,erp_private.grow_initial());rev:=coalesce(rev,0);
 select e.field into field from public.erp_enrolments e where e.cohort_id=c and e.user_id=u and e.role='mentee' and e.active;
 t:=erp_private.grow_track(field);if t is null then raise exception 'Track mentee belum ditetapkan. Hubungi pengelola.';end if;
 foreach p in array array[3,6,9,12] loop
  if r='mentee' then
   select x into pub from jsonb_array_elements(s->'publications') with ordinality a(x,ord) where (x->>'period')::int=p order by ord desc limit 1;
   scores:=scores||jsonb_build_object(p::text,coalesce(pub->'score',jsonb_build_object('asmen',null,'mentor',null,'total',null,'checked',0,'eligible',0,'waiting',0)));
  else scores:=scores||jsonb_build_object(p::text,erp_private.grow_score(s,p,(now() at time zone 'Asia/Jakarta')::date));end if;
 end loop;
 if r<>'mentee' then
  if s#>>'{canvas,status}'='Draft' then s:=jsonb_set(s,'{canvas}','null');end if;
  s:=jsonb_set(s,'{canvasHistory}',coalesce((select jsonb_agg(x) from jsonb_array_elements(s->'canvasHistory') x where x->>'status'<>'Draft'),'[]'));
  s:=jsonb_set(s,'{notes}',coalesce((select jsonb_agg(x order by ord) from jsonb_array_elements(s->'notes') with ordinality a(x,ord) where x->>'status'<>'Draft'),'[]'));
 else
  s:=jsonb_set(s,'{reviews}',coalesce((select jsonb_object_agg(period,review) from (select distinct on (x->>'period') x->>'period' as period,x->'review' as review from jsonb_array_elements(s->'publications') with ordinality a(x,ord) order by x->>'period',ord desc) q),'{}'));
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'version',l.revision,'status',l.status,'data',l.data) order by l.updated_at),'[]') into logs from public.erp_group_session_logs l where l.cohort_id=c and (r<>'mentee' or l.status='Tercatat') and exists(select 1 from public.erp_group_members m where m.group_id=l.group_id and m.user_id=u and m.active) and exists(select 1 from jsonb_array_elements(l.data->'attendance') a where a->>'user_id'=u::text);
 return s||jsonb_build_object('sessions',logs,'revision',rev,'role',r,'track',t,'scores',scores,'cohort',c,'mentee',u,'today',(now() at time zone 'Asia/Jakarta')::date);
end $$;
create function erp_private.grow_command(c uuid,u uuid,action text,d jsonb,expected integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare s jsonb;oldstate jsonb;rev integer;role text;cv jsonb;old jsonb;note jsonb;it jsonb;v jsonb;ids text[];chosen text[];kp jsonb;cat jsonb;field text;track text;key text;index integer;pos integer;period integer;month integer;stamp date;today date:=(now() at time zone 'Asia/Jakarta')::date;newid uuid;result jsonb;log public.erp_group_session_logs;
begin
 role:=case when action in ('canvas_save','canvas_submit','note_save','note_submit','outcome_save') then 'mentee' when action in ('canvas_check','action_check') then 'asmen' when action in ('canvas_agree','canvas_return','support_reply','review_save','publish') then 'mentor' else null end;
 if role is null then raise exception 'Permintaan GROW tidak dikenali.';end if;
 perform erp_private.grow_access(c,u,role);
 if d is null or jsonb_typeof(d)<>'object' or octet_length(d::text)>100000 then raise exception 'Isian GROW terlalu panjang atau belum benar.';end if;
 perform pg_advisory_xact_lock(hashtext(c::text),hashtext(u::text));
 select state,revision into s,rev from erp_private.grow_workspaces where cohort_id=c and mentee_id=u for update;
 s:=coalesce(s,erp_private.grow_initial());rev:=coalesce(rev,0);oldstate:=s;
 if expected is distinct from rev then raise exception 'Data berubah di tampilan lain. Muat ulang; isian belum disimpan.' using errcode='40001';end if;
 cv:=nullif(s->'canvas','null'::jsonb);
 select e.field into field from public.erp_enrolments e where e.cohort_id=c and e.user_id=u and e.role='mentee' and e.active;
 track:=erp_private.grow_track(field);cat:=erp_private.grow_catalog(track);
 if cat is null then raise exception 'Track mentee belum ditetapkan.';end if;
 if cv is not null and cv->>'track' is distinct from track then raise exception 'Track berubah setelah GROW dibuat. Hubungi pengelola sebelum melanjutkan.';end if;
 if action in ('canvas_save','canvas_submit') then
  if cv is not null and cv->>'status' not in ('Draft','Perlu perbaikan') then raise exception 'GROW yang diajukan atau disepakati tidak ditulis ulang.';end if;
  if jsonb_typeof(d->'kpis') is distinct from 'array' or jsonb_array_length(d->'kpis')>16 then raise exception 'Pilih KPI dari track mentee.';end if;
  select array_agg(x->>'id' order by x->>'id') into ids from jsonb_array_elements(d->'kpis') x;
  if cardinality(ids)<>(select count(distinct x) from unnest(ids) x) or exists(select 1 from unnest(ids) x where not exists(select 1 from jsonb_array_elements(cat->'kpis') k where k->>'id'=x)) then raise exception 'Pilih KPI berbeda dari katalog track mentee.';end if;
  if action='canvas_submit' then
   foreach key in array array['goal','why','reality','options','wayForward','mentorNeed'] loop perform erp_private.grow_need(d->key,key);end loop;
   if coalesce(cardinality(ids),0)=0 then raise exception 'Pilih sedikitnya satu KPI.';end if;
   for kp in select * from jsonb_array_elements(d->'kpis') loop
    perform erp_private.grow_need(kp->'baseline','baseline KPI');perform erp_private.grow_need(kp->'measurement','cara ukur dan bukti');
    foreach period in array array[3,6,9,12] loop perform erp_private.grow_need(kp->'milestones'->period::text,'milestone M'||period);end loop;
    if kp#>>'{milestones,12}' is distinct from (select k->>'label' from jsonb_array_elements(cat->'kpis') k where k->>'id'=kp->>'id') then raise exception 'Target M12 mengikuti katalog KPI.';end if;
   end loop;
  end if;
  if cv is not null then s:=jsonb_set(s,'{canvasHistory}',s->'canvasHistory'||jsonb_build_array(cv));end if;
  s:=jsonb_set(s,'{canvas}',jsonb_build_object('track',track,'version',coalesce((cv->>'version')::int,0)+1,'data',d,'status',case when action='canvas_submit' then 'Diajukan' else 'Draft' end,'at',now(),'actor',auth.uid()));
 elsif action in ('canvas_check','canvas_agree','canvas_return') then
  if cv is null or cv->>'status' not in ('Diajukan','Siap dibahas Mentor') then raise exception 'Belum ada GROW yang dapat diperiksa.';end if;
  perform erp_private.grow_need(d->'comment','catatan pendamping');
  if action='canvas_check' then
   if coalesce(d->>'decision','') not in ('Siap dibahas Mentor','Perlu perbaikan') then raise exception 'Pilih hasil pemeriksaan.';end if;
   cv:=cv||jsonb_build_object('status',d->>'decision','asmenComment',d->>'comment','checkedBy',auth.uid());
  else
   if action='canvas_agree' and cv->>'status'<>'Siap dibahas Mentor' then raise exception 'Pemeriksaan Asmen belum selesai.';end if;
   cv:=cv||jsonb_build_object('status',case when action='canvas_agree' then 'Disepakati' else 'Perlu perbaikan' end,'mentorComment',d->>'comment','agreedBy',auth.uid());
  end if;s:=jsonb_set(s,'{canvas}',cv);
 elsif action in ('note_save','note_submit') then
  v:=d->'data';if jsonb_typeof(v) is distinct from 'object' then raise exception 'Isian catatan belum benar.';end if;
  select x,ord::integer-1 into old,pos from jsonb_array_elements(s->'notes') with ordinality a(x,ord) where x->>'id'=d->>'id';
  if d->>'id' is not null and old is null then raise exception 'Draft tidak ditemukan.';end if;
  if old is not null and old->>'status'<>'Draft' then raise exception 'Catatan yang diajukan menjadi riwayat; buat catatan berikutnya.';end if;
  if coalesce(v->>'kind','') not in ('','Sesi kelompok','1-on-1','Common Class') or coalesce(v->>'format','') not in ('','Online','Offline','Hybrid') or (coalesce(v->>'time','')<>'' and v->>'time' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') then raise exception 'Jenis, format, atau jam sesi belum benar.';end if;
  if coalesce(v->>'date','')<>'' then stamp:=(v->>'date')::date;month:=erp_private.grow_month(c,stamp);if stamp>today then raise exception 'Tanggal pertemuan tidak boleh melewati hari ini.';end if;else month:=1;end if;
  if coalesce(v->>'session','')<>'' then
   select * into log from public.erp_group_session_logs l where l.id=(v->>'session')::uuid and l.cohort_id=c and l.status='Tercatat' and exists(select 1 from public.erp_group_members m where m.group_id=l.group_id and m.user_id=u and m.active) and exists(select 1 from jsonb_array_elements(l.data->'attendance') a where a->>'user_id'=u::text);
   if log.id is null or v->>'date' is distinct from log.data->>'date' then raise exception 'Sesi terkait tidak tersedia untuk mentee atau tanggal belum sesuai.';end if;
  end if;
  if action='note_submit' then
   foreach key in array array['learning','action','due','date'] loop perform erp_private.grow_need(v->key,key);end loop;
   perform erp_private.grow_month(c,(v->>'due')::date);if (v->>'due')::date<stamp then raise exception 'Tenggat tidak boleh sebelum pertemuan.';end if;
  end if;
  note:=jsonb_build_object('id',coalesce(old->>'id',gen_random_uuid()::text),'status',case when action='note_submit' then 'Diajukan' else 'Draft' end,'data',v,'month',month,'period',((month-1)/3+1)*3,'canvasVersion',case when cv->>'status'='Disepakati' then cv->'version' else null end,'sessionVersion',log.revision,'outcomeRevision',0,'createdBy',auth.uid());
  if old is null then s:=jsonb_set(s,'{notes}',s->'notes'||jsonb_build_array(note));else s:=jsonb_set(s,array['notes',pos::text],note);end if;
 elsif action in ('outcome_save','action_check') then
  select x,ord::integer-1 into note,pos from jsonb_array_elements(s->'notes') with ordinality a(x,ord) where x->>'id'=d->>'id' and x->>'status'='Diajukan';
  if note is null then raise exception 'Catatan tidak ditemukan atau belum diajukan.';end if;
  old:=coalesce(note->'outcome','{}');
  if action='outcome_save' then
   if coalesce(d->>'status','') not in ('Belum berjalan','Sebagian','Selesai') then raise exception 'Pilih status action.';end if;
   perform erp_private.grow_need(d->'result','hasil atau hambatan');perform erp_private.grow_url(d->>'url');
   if d->>'status'='Selesai' then stamp:=(d->>'completed')::date;if stamp is null or stamp<(note#>>'{data,date}')::date or stamp>today then raise exception 'Tanggal selesai harus sesuai waktu pelaksanaan.';end if;end if;
   note:=note||jsonb_build_object('outcome',d,'outcomeRevision',coalesce((note->>'outcomeRevision')::int,0)+1,'outcomeHistory',coalesce(note->'outcomeHistory','[]')||case when old='{}' then '[]'::jsonb else jsonb_build_array(old) end);
  else
   if coalesce(old->>'status','')<>'Selesai' and (note#>>'{data,due}')::date>=today then raise exception 'Action belum jatuh tempo; belum diberi poin.';end if;
   foreach key in array array['execution','timeliness','evidence'] loop if jsonb_typeof(d->key) is distinct from 'number' or coalesce(d->>key,'') not in ('0','5','10') then raise exception 'Pilih poin 0, 5, atau 10 untuk setiap aspek.';end if;end loop;
   perform erp_private.grow_need(d->'comment','alasan pemeriksaan Asmen');
   if d->>'execution'='10' and coalesce(old->>'status','')<>'Selesai' then raise exception 'Poin selesai memerlukan laporan action selesai.';end if;
   if d->>'timeliness'<>'0' and d->>'execution'<>'10' then raise exception 'Poin waktu memerlukan action yang dinilai selesai.';end if;
   if d->>'timeliness'='0' and d->>'execution'='10' then raise exception 'Pilih selesai tepat waktu atau terlambat.';end if;
   if d->>'timeliness'='10' and (coalesce(old->>'status','')<>'Selesai' or (old->>'completed')::date>(note#>>'{data,due}')::date) then raise exception 'Tanggal selesai melewati tenggat; tidak dapat diberi poin tepat waktu.';end if;
   if d->>'timeliness'='5' and (coalesce(old->>'status','')<>'Selesai' or (old->>'completed')::date<=(note#>>'{data,due}')::date) then raise exception 'Poin terlambat memerlukan tanggal selesai setelah tenggat.';end if;
   if d->>'evidence'<>'0' and coalesce(old->>'result','')='' then raise exception 'Belum ada hasil yang dapat diperiksa.';end if;
   note:=note||jsonb_build_object('check',jsonb_build_object('data',d,'outcomeRevision',coalesce((note->>'outcomeRevision')::int,0),'actor',auth.uid(),'at',now()));
  end if;s:=jsonb_set(s,array['notes',pos::text],note);
 elsif action='support_reply' then
  key:=d->>'key';if not ((key='canvas' and cv is not null and cv->>'status'<>'Draft') or exists(select 1 from jsonb_array_elements(s->'notes') n where n->>'id'=key and n->>'status'='Diajukan' and coalesce(n#>>'{data,mentorNeed}','')<>'')) then raise exception 'Kebutuhan pendampingan tidak tersedia.';end if;
  perform erp_private.grow_need(d->'reply','tanggapan Mentor');if coalesce(d->>'status','') not in ('Dibahas','Ditindaklanjuti') then raise exception 'Pilih status tanggapan.';end if;
  s:=jsonb_set(s,array['supportReplies',key],jsonb_build_object('reply',d->>'reply','status',d->>'status','actor',auth.uid(),'at',now()));
 elsif action='review_save' then
  if cv is null or cv->>'status'<>'Disepakati' then raise exception 'GROW belum disepakati.';end if;
  period:=(d->>'period')::int;if period is null or period not in (3,6,9,12) or jsonb_typeof(d->'items') is distinct from 'array' then raise exception 'Pilih periode dan nilai semua KPI.';end if;
  select array_agg(x->>'id' order by x->>'id') into ids from jsonb_array_elements(d->'items') x;
  select array_agg(x->>'id' order by x->>'id') into chosen from jsonb_array_elements(cv#>'{data,kpis}') x;
  if ids is distinct from chosen then raise exception 'Nilai semua KPI yang dipilih dalam GROW.';end if;
  for it in select * from jsonb_array_elements(d->'items') loop
   if jsonb_typeof(it->'level') is distinct from 'number' or coalesce(it->>'level','') not in ('0','25','50','75','100') then raise exception 'Pilih tingkat capaian yang tersedia.';end if;
   perform erp_private.grow_need(it->'actual','hasil aktual');perform erp_private.grow_need(it->'reason','alasan penilaian');perform erp_private.grow_url(it->>'url');
   if it->>'level'<>'0' and length(trim(coalesce(it->>'url','')||coalesce(it->>'evidence','')))=0 then raise exception 'Cantumkan bukti hasil atau uraian bukti yang diperiksa.';end if;
  end loop;
  s:=jsonb_set(s,array['reviews',period::text],jsonb_build_object('items',d->'items','canvasVersion',cv->'version','sources',erp_private.grow_sources(s,period),'actor',auth.uid(),'at',now()));
 elsif action='publish' then
  period:=(d->>'period')::int;if period is null or period not in (3,6,9,12) then raise exception 'Periode tidak tersedia.';end if;
  if today<(select (starts_on+make_interval(months=>period)-interval '1 day')::date from public.erp_cohorts where id=c) then raise exception 'Raport periode ini belum dapat diterbitkan sebelum akhir milestone.';end if;
  result:=erp_private.grow_score(s,period,today);if result->>'total' is null then raise exception 'Raport belum lengkap: periksa action dan simpan review Mentor terbaru.';end if;
  s:=jsonb_set(s,'{publications}',s->'publications'||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'period',period,'score',result,'canvasVersion',cv->'version','canvas',cv,'review',s->'reviews'->period::text,'actions',(select coalesce(jsonb_agg(n),'[]') from jsonb_array_elements(s->'notes') n where n->>'status'='Diajukan' and (n->>'period')::int=period),'actor',auth.uid(),'at',now())));
 end if;
 if s=oldstate then raise exception 'Tidak ada perubahan yang dapat disimpan.';end if;
 insert into erp_private.grow_workspaces(cohort_id,mentee_id,state,revision)values(c,u,s,rev+1) on conflict(cohort_id,mentee_id) do update set state=excluded.state,revision=excluded.revision,updated_at=now();
 insert into erp_private.grow_events(cohort_id,mentee_id,actor_id,action,revision,snapshot)values(c,u,auth.uid(),action,rev+1,s);
 return erp_private.grow_state(c,u,role);
end $$;
create function public.erp_grow_state(p_cohort uuid,p_mentee uuid,p_role text) returns jsonb language sql security invoker set search_path='' as $$select erp_private.grow_state(p_cohort,p_mentee,p_role)$$;
create function public.erp_grow_command(p_cohort uuid,p_mentee uuid,p_action text,p_data jsonb,p_expected integer) returns jsonb language sql security invoker set search_path='' as $$select erp_private.grow_command(p_cohort,p_mentee,p_action,p_data,p_expected)$$;
-- Privileged code remains private; public wrappers execute only for authenticated sessions.
revoke all on function erp_private.grow_initial(),erp_private.grow_track(text),erp_private.grow_catalog(text),erp_private.grow_need(jsonb,text),erp_private.grow_url(text),erp_private.grow_month(uuid,date),erp_private.grow_access(uuid,uuid,text),erp_private.grow_sources(jsonb,integer),erp_private.grow_score(jsonb,integer,date),erp_private.grow_state(uuid,uuid,text),erp_private.grow_command(uuid,uuid,text,jsonb,integer),public.erp_grow_state(uuid,uuid,text),public.erp_grow_command(uuid,uuid,text,jsonb,integer) from public,anon,authenticated;
grant execute on function erp_private.grow_state(uuid,uuid,text),erp_private.grow_command(uuid,uuid,text,jsonb,integer),public.erp_grow_state(uuid,uuid,text),public.erp_grow_command(uuid,uuid,text,jsonb,integer) to authenticated;
