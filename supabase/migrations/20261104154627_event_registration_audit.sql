-- Service registration has no human actor. Record its timestamp on the assignment;
-- operational attendance actions keep using the existing authenticated audit trail.
begin;
alter table erp_private.event_staff add column created_at timestamptz not null default now();
create or replace function erp_private.event_account_service(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
 return jsonb_build_object('ok',true);
end $$;
commit;
