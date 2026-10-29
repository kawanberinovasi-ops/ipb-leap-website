-- IPB LEAP: schema operasional kosong. Tidak ada seed peserta, kelompok, atau nilai.
create schema if not exists erp_private;
revoke all on schema erp_private from public, anon;
grant usage on schema erp_private to authenticated;

create table public.erp_profiles (
 id uuid primary key references auth.users(id), display_name text not null,
 email text not null, roles text[] not null default '{}', active boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (roles <@ array['mentee','asmen','mentor','program','finance','system']::text[])
);
create table public.erp_cohorts (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name))>0),
 starts_on date not null, ends_on date not null, active boolean not null default true,
 created_by uuid not null references public.erp_profiles(id), created_at timestamptz not null default now(),
 check(ends_on>=starts_on)
);
create table public.erp_cohort_staff (
 cohort_id uuid references public.erp_cohorts(id), user_id uuid references public.erp_profiles(id),
 can_manage boolean not null default false, can_assess boolean not null default false,
 primary key(cohort_id,user_id)
);
create table public.erp_enrolments (
 cohort_id uuid references public.erp_cohorts(id), user_id uuid references public.erp_profiles(id),
 role text not null check(role in ('mentee','asmen','mentor','program','finance')),
 field text not null default '', pathway text not null default '', active boolean not null default true,
 primary key(cohort_id,user_id,role)
);
create table public.erp_groups (
 id uuid primary key default gen_random_uuid(), cohort_id uuid not null references public.erp_cohorts(id),
 name text not null check(length(trim(name))>0), field text not null,
 mentor_id uuid references public.erp_profiles(id), asmen_id uuid references public.erp_profiles(id),
 active boolean not null default false, created_at timestamptz not null default now(),
 unique(cohort_id,name), check(mentor_id is distinct from asmen_id)
);
create table public.erp_group_members (
 id uuid primary key default gen_random_uuid(), group_id uuid not null references public.erp_groups(id),
 user_id uuid not null references public.erp_profiles(id), active boolean not null default true,
 joined_at timestamptz not null default now(), left_at timestamptz
);
create unique index erp_active_member on public.erp_group_members(group_id,user_id) where active;
create table public.erp_sessions (
 id uuid primary key default gen_random_uuid(), cohort_id uuid not null references public.erp_cohorts(id),
 group_id uuid not null references public.erp_groups(id), kind text not null check(kind in ('checkin','mentoring')),
 starts_at timestamptz not null, month_no int not null check(month_no between 2 and 12),
 participant_ids uuid[] not null, cancelled boolean not null default false, cancellation_reason text,
 created_by uuid not null references public.erp_profiles(id), created_at timestamptz not null default now(),
 unique(group_id,kind,starts_at), check(not cancelled or length(trim(cancellation_reason))>0)
);
create table public.erp_records (
 id uuid primary key default gen_random_uuid(), cohort_id uuid not null references public.erp_cohorts(id),
 mentee_id uuid not null references public.erp_profiles(id),
 kind text not null check(kind in ('poc','abc','checkin','mentoring','actual','review','portfolio')),
 month_no int not null check(month_no between 0 and 12), session_id uuid references public.erp_sessions(id),
 latest_version int not null default 0, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index erp_one_poc on public.erp_records(cohort_id,mentee_id) where kind='poc';
create unique index erp_one_period_record on public.erp_records(cohort_id,mentee_id,kind,month_no) where kind in ('mentoring','actual','review','portfolio');
create unique index erp_one_session_report on public.erp_records(session_id,mentee_id) where kind='checkin';
create table public.erp_versions (
 id uuid primary key default gen_random_uuid(), record_id uuid not null references public.erp_records(id),
 number int not null check(number>0), status text not null, data jsonb not null,
 actor_id uuid not null references public.erp_profiles(id), action text not null,
 created_at timestamptz not null default now(), unique(record_id,number),
 check(status in ('Draft','Diajukan','Perlu perbaikan','Sudah diperiksa','Disepakati','Diterbitkan'))
);
create table public.erp_checks (
 id uuid primary key default gen_random_uuid(), record_id uuid not null references public.erp_records(id),
 source_version_id uuid not null references public.erp_versions(id),
 kind text not null check(kind in ('abc','commitment','process','evidence','mentoring','poc')),
 data jsonb not null, actor_id uuid not null references public.erp_profiles(id), created_at timestamptz not null default now()
);
create table public.erp_publications (
 id uuid primary key default gen_random_uuid(), record_id uuid not null references public.erp_records(id),
 version_id uuid not null references public.erp_versions(id), number int not null,
 score jsonb not null, sources jsonb not null, actor_id uuid not null references public.erp_profiles(id),
 created_at timestamptz not null default now(), unique(record_id,number)
);
create table public.erp_audit (
 id uuid primary key default gen_random_uuid(), cohort_id uuid references public.erp_cohorts(id),
 actor_id uuid not null references public.erp_profiles(id), action text not null,
 entity_id uuid, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create table erp_private.settings (
 singleton boolean primary key default true check(singleton), bootstrap_email text not null,
 admin_created boolean not null default false, created_at timestamptz not null default now()
);

create index erp_staff_user on public.erp_cohort_staff(user_id,cohort_id);
create index erp_enrol_user on public.erp_enrolments(user_id,cohort_id) where active;
create index erp_groups_mentor on public.erp_groups(mentor_id,cohort_id);
create index erp_groups_asmen on public.erp_groups(asmen_id,cohort_id);
create index erp_members_user on public.erp_group_members(user_id,group_id) where active;
create index erp_records_subject on public.erp_records(cohort_id,mentee_id,kind,month_no);
create index erp_versions_latest on public.erp_versions(record_id,number desc);
create index erp_checks_source on public.erp_checks(record_id,source_version_id,created_at desc);
create index erp_publications_latest on public.erp_publications(record_id,number desc);
create index erp_sessions_scope on public.erp_sessions(cohort_id,group_id,month_no,starts_at);

-- Helper berhak tinggi hanya di schema privat, selalu terikat sesi Auth yang masih hidup.
create function erp_private.session_valid() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists (
  select 1 from auth.users u join auth.sessions s on s.user_id=u.id
  where u.id=auth.uid() and u.email_confirmed_at is not null
   and s.id::text=auth.jwt()->>'session_id'
 );
$$;
create function erp_private.has_role(p_role text) returns boolean language sql stable security definer set search_path='' as $$
 select erp_private.session_valid() and exists(select 1 from public.erp_profiles p where p.id=auth.uid() and p.active and p_role=any(p.roles));
$$;
create function erp_private.manages(p_cohort uuid) returns boolean language sql stable security definer set search_path='' as $$
 select erp_private.has_role('system') or (erp_private.has_role('program') and exists(select 1 from public.erp_cohort_staff s where s.cohort_id=p_cohort and s.user_id=auth.uid() and s.can_manage));
$$;
create function erp_private.assesses(p_cohort uuid) returns boolean language sql stable security definer set search_path='' as $$
 select erp_private.has_role('program') and exists(select 1 from public.erp_cohort_staff s where s.cohort_id=p_cohort and s.user_id=auth.uid() and s.can_assess);
$$;
create function erp_private.can_cohort(p_cohort uuid) returns boolean language sql stable security definer set search_path='' as $$
 select erp_private.manages(p_cohort) or erp_private.assesses(p_cohort)
 or (erp_private.session_valid() and exists(select 1 from public.erp_enrolments e join public.erp_profiles p on p.id=e.user_id where e.cohort_id=p_cohort and e.user_id=auth.uid() and e.active and p.active));
$$;
create function erp_private.can_group(p_group uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.erp_groups g where g.id=p_group and (
 erp_private.manages(g.cohort_id) or erp_private.assesses(g.cohort_id)
 or (erp_private.has_role('mentor') and g.mentor_id=auth.uid())
 or (erp_private.has_role('asmen') and g.asmen_id=auth.uid())
 or (erp_private.has_role('mentee') and exists(select 1 from public.erp_group_members m where m.group_id=g.id and m.user_id=auth.uid() and m.active))));
$$;
create function erp_private.staff_for(p_cohort uuid,p_mentee uuid,p_role text) returns boolean language sql stable security definer set search_path='' as $$
 select erp_private.has_role(p_role) and exists(select 1 from public.erp_groups g join public.erp_group_members m on m.group_id=g.id
 where g.cohort_id=p_cohort and m.user_id=p_mentee and m.active and g.active
 and exists(select 1 from public.erp_enrolments e where e.cohort_id=p_cohort and e.user_id=auth.uid() and e.role=p_role and e.active)
 and ((p_role='mentor' and g.mentor_id=auth.uid()) or (p_role='asmen' and g.asmen_id=auth.uid())));
$$;
create function erp_private.can_subject(p_cohort uuid,p_mentee uuid) returns boolean language sql stable security definer set search_path='' as $$
 select (erp_private.has_role('mentee') and auth.uid()=p_mentee and exists(select 1 from public.erp_enrolments e where e.cohort_id=p_cohort and e.user_id=p_mentee and e.role='mentee' and e.active))
 or erp_private.staff_for(p_cohort,p_mentee,'mentor') or erp_private.staff_for(p_cohort,p_mentee,'asmen') or erp_private.assesses(p_cohort);
$$;
create function erp_private.can_record(p_record uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.erp_records r where r.id=p_record and erp_private.can_subject(r.cohort_id,r.mentee_id));
$$;
create function erp_private.can_profile(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select erp_private.session_valid() and (p_user=auth.uid() or erp_private.has_role('system')
 or exists(select 1 from public.erp_cohort_staff s where s.user_id=auth.uid() and s.can_manage and erp_private.has_role('program'))
 or exists(select 1 from public.erp_enrolments e where e.user_id=p_user and e.active and erp_private.can_subject(e.cohort_id,p_user))
 or exists(select 1 from public.erp_groups g where erp_private.can_group(g.id) and (g.mentor_id=p_user or g.asmen_id=p_user)));
$$;

alter table public.erp_profiles enable row level security;
alter table public.erp_cohorts enable row level security;
alter table public.erp_cohort_staff enable row level security;
alter table public.erp_enrolments enable row level security;
alter table public.erp_groups enable row level security;
alter table public.erp_group_members enable row level security;
alter table public.erp_sessions enable row level security;
alter table public.erp_records enable row level security;
alter table public.erp_versions enable row level security;
alter table public.erp_checks enable row level security;
alter table public.erp_publications enable row level security;
alter table public.erp_audit enable row level security;
alter table erp_private.settings enable row level security;

create policy profiles_read on public.erp_profiles for select to authenticated using(erp_private.can_profile(id));
create policy cohorts_read on public.erp_cohorts for select to authenticated using(erp_private.can_cohort(id));
create policy cohort_staff_read on public.erp_cohort_staff for select to authenticated using(erp_private.can_cohort(cohort_id));
create policy enrolments_read on public.erp_enrolments for select to authenticated using(erp_private.session_valid() and (erp_private.manages(cohort_id) or erp_private.can_subject(cohort_id,user_id) or user_id=(select auth.uid())));
create policy groups_read on public.erp_groups for select to authenticated using(erp_private.can_group(id));
create policy group_members_read on public.erp_group_members for select to authenticated using(erp_private.can_group(group_id));
create policy sessions_read on public.erp_sessions for select to authenticated using(erp_private.can_group(group_id));
create policy records_read on public.erp_records for select to authenticated using(erp_private.can_subject(cohort_id,mentee_id));
create policy versions_read on public.erp_versions for select to authenticated using(erp_private.can_record(record_id) and exists(select 1 from public.erp_records r where r.id=record_id and (
 (r.mentee_id=(select auth.uid()) and (r.kind<>'review' or status='Diterbitkan'))
 or (r.kind='review' and (erp_private.staff_for(r.cohort_id,r.mentee_id,'mentor') or erp_private.assesses(r.cohort_id)))
 or (r.kind<>'review' and status<>'Draft')
 or status='Diterbitkan'
)));
create policy checks_read on public.erp_checks for select to authenticated using(erp_private.can_record(record_id));
create policy publications_read on public.erp_publications for select to authenticated using(erp_private.can_record(record_id));
create policy audit_read on public.erp_audit for select to authenticated using(erp_private.manages(cohort_id));

revoke all on public.erp_profiles,public.erp_cohorts,public.erp_cohort_staff,public.erp_enrolments,public.erp_groups,public.erp_group_members,public.erp_sessions,public.erp_records,public.erp_versions,public.erp_checks,public.erp_publications,public.erp_audit from anon,authenticated;
grant select on public.erp_profiles,public.erp_cohorts,public.erp_cohort_staff,public.erp_enrolments,public.erp_groups,public.erp_group_members,public.erp_sessions,public.erp_records,public.erp_versions,public.erp_checks,public.erp_publications,public.erp_audit to authenticated;
revoke all on all functions in schema erp_private from public,anon,authenticated;
grant execute on function erp_private.session_valid(),erp_private.has_role(text),erp_private.manages(uuid),erp_private.assesses(uuid),erp_private.can_cohort(uuid),erp_private.can_group(uuid),erp_private.staff_for(uuid,uuid,text),erp_private.can_subject(uuid,uuid),erp_private.can_record(uuid),erp_private.can_profile(uuid) to authenticated;
comment on schema erp_private is 'Internal ERP IPB LEAP. Tidak diekspos Data API; setiap fungsi berhak tinggi memeriksa sesi dan kewenangan.';
