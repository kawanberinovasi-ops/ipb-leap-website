-- Service-only extension of existing activation flow. Never grant service_role to a browser.
begin;
create function erp_private.managed_account_service(action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=(p->>'actor')::uuid; sid uuid:=(p->>'session')::uuid; c uuid:=(p->>'cohort')::uuid;
 target uuid:=(p->>'user')::uuid; roles_requested text[]; a public.erp_profiles; t public.erp_profiles; u auth.users; rev integer; is_system boolean;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Akses layanan ditolak.' using errcode='42501'; end if;
 select * into a from public.erp_profiles where id=actor and active;
 if a.id is null or not exists(select 1 from auth.sessions s join auth.users n on n.id=s.user_id where s.id=sid and s.user_id=actor and (s.not_after is null or s.not_after>now()) and n.email_confirmed_at is not null) then raise exception 'Sesi akun tidak sah.' using errcode='42501'; end if;
 is_system:='system'=any(a.roles);
 if c is null or not exists(select 1 from public.erp_cohorts where id=c) or (not is_system and not ('program'=any(a.roles) and exists(select 1 from public.erp_cohort_staff where cohort_id=c and user_id=actor and can_manage))) then raise exception 'Tidak ditugaskan mengelola cohort ini.' using errcode='42501'; end if;
 if action not in ('authorize','provision','reissue') then raise exception 'Permintaan akun tidak dikenali.'; end if;
 if p->>'operation'='create' or action='provision' then
  select array_agg(value) into roles_requested from jsonb_array_elements_text(p->'roles');
  if coalesce(cardinality(roles_requested),0)<>1 or not roles_requested<@array['mentee','mentor','asmen','program','finance']::text[] or (not is_system and not roles_requested<@array['mentee','mentor','asmen']::text[]) then raise exception 'Pengelola cohort hanya dapat menambahkan mentee, Mentor atau Asmen. Peran pengelola/keuangan ditetapkan Super Admin.' using errcode='42501'; end if;
  if roles_requested[1]='mentee' and not erp_private.track_pathway_valid(p->>'field',p->>'pathway') then raise exception 'Isi track dan pathway peserta.'; end if;
 else
  select * into t from public.erp_profiles where id=target;
  if t.id is null or not exists(select 1 from public.erp_enrolments where cohort_id=c and user_id=target) or (not is_system and not t.roles<@array['mentee','mentor','asmen']::text[]) then raise exception 'Aktivasi akun ini di luar kewenangan pengelola.' using errcode='42501'; end if;
 end if;
 if action='authorize' then return jsonb_build_object('ok',true); end if;
 select revision into rev from public.erp_cohorts where id=c for update;
 if action='provision' then
  if rev is distinct from (p->>'expected')::integer then raise exception 'Data berubah. Muat ulang sebelum membuat akun.' using errcode='40001'; end if;
  select * into u from auth.users where id=target;
  if u.id is null or u.email is distinct from p->>'email' or coalesce(length(trim(p->>'name')),0) not between 2 and 120 then raise exception 'Identitas akun belum lengkap.'; end if;
  insert into public.erp_profiles(id,email,display_name,roles) values(target,u.email,trim(p->>'name'),roles_requested);
  insert into public.erp_enrolments(cohort_id,user_id,role,field,pathway) values(c,target,roles_requested[1],coalesce(p->>'field',''),coalesce(p->>'pathway',''));
 else
  select * into t from public.erp_profiles where id=target for update;
  if t.active then raise exception 'Akun sudah aktif; tidak perlu aktivasi ulang.'; end if;
 end if;
 if p->>'hash' !~ '^[a-f0-9]{64}$' then raise exception 'Token aktivasi tidak sah.'; end if;
 update erp_private.activations set used_at=now() where user_id=target and used_at is null;
 insert into erp_private.activations(user_id,token_hash,expires_at,created_by) values(target,p->>'hash',now()+interval '14 days',actor);
 update public.erp_cohorts set revision=revision+1 where id=c;
 insert into public.erp_audit(cohort_id,actor_id,action,entity_id) values(c,actor,'Menyiapkan aktivasi akun',target);
 return jsonb_build_object('ok',true);
end $$;
create function public.erp_managed_account_service(p_action text,p jsonb) returns jsonb language sql set search_path='' as $$select erp_private.managed_account_service(p_action,p)$$;
revoke all on function erp_private.managed_account_service(text,jsonb),public.erp_managed_account_service(text,jsonb) from public,anon,authenticated;
grant usage on schema erp_private to service_role;
grant execute on function erp_private.managed_account_service(text,jsonb),public.erp_managed_account_service(text,jsonb) to service_role;
commit;
