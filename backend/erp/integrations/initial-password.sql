-- Initial passwords are entered privately by the operator and handled by Auth.
-- No plaintext password is stored in ERP tables or exports.
begin;
create table erp_private.password_setup (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 completed_at timestamptz
);
alter table erp_private.password_setup enable row level security;
revoke all on erp_private.password_setup from public,anon,authenticated;
create policy password_setup_no_client on erp_private.password_setup for all to anon,authenticated using(false) with check(false);

create function erp_private.complete_initial_password() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.encrypted_password is distinct from old.encrypted_password and coalesce(new.encrypted_password,'')<>'' then
  update erp_private.password_setup set completed_at=clock_timestamp() where user_id=new.id and completed_at is null;
  if found then
   update public.erp_profiles set active=true,updated_at=now() where id=new.id;
   insert into public.erp_audit(actor_id,action,entity_id) values(new.id,'Mengganti password awal',new.id);
  end if;
 end if;
 return new;
end $$;
revoke all on function erp_private.complete_initial_password() from public,anon,authenticated;
create trigger erp_initial_password_changed after update of encrypted_password on auth.users for each row execute function erp_private.complete_initial_password();

create or replace function erp_private.session_valid() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from auth.users u join auth.sessions s on s.user_id=u.id
  left join erp_private.password_setup p on p.user_id=u.id
  where u.id=auth.uid() and u.email_confirmed_at is not null
  and s.id::text=auth.jwt()->>'session_id' and (s.not_after is null or s.not_after>now())
  and (p.user_id is null or (p.completed_at is not null and s.created_at>=p.completed_at))
 );
$$;

-- Bootstrap exposes only the owner's registration identity while the gate is on.
-- All ERP roles, RLS reads and operational RPCs still use session_valid().
do $$
declare definition text;
begin
 definition:=pg_get_functiondef('erp_private.ensure_profile()'::regprocedure);
 if position('if not erp_private.session_valid()' in lower(definition))=0 then raise exception 'Unexpected bootstrap definition.'; end if;
 definition:=replace(definition,'if not erp_private.session_valid()',
 'if exists(select 1 from erp_private.password_setup where user_id=auth.uid() and completed_at is null)
 and exists(select 1 from auth.users au join auth.sessions se on se.user_id=au.id where au.id=auth.uid() and au.email_confirmed_at is not null and se.id::text=auth.jwt()->>''session_id'' and (se.not_after is null or se.not_after>now())) then
  select * into p from public.erp_profiles where id=auth.uid();
  return jsonb_build_object(''id'',p.id,''display_name'',p.display_name,''email'',p.email,''active'',false,''roles'',''[]''::jsonb,''mustChangePassword'',true);
 end if;
 if not erp_private.session_valid()');
 execute definition;

 definition:=pg_get_functiondef('erp_private.managed_account_service(text,jsonb)'::regprocedure);
 if position('if action=''authorize'' then' in definition)=0 or position('if p->>''hash'' !~' in definition)=0 then raise exception 'Unexpected managed account definition.'; end if;
 definition:=replace(definition,'if action=''authorize'' then',
 'if coalesce((p->>''password_login'')::boolean,false) and (p->>''operation''<>''create'' or roles_requested[1] not in (''mentee'',''asmen'')) then raise exception ''Password awal hanya untuk pendaftaran Mentee dan Asmen.''; end if;
 if action=''authorize'' then');
 definition:=replace(definition,'if p->>''hash'' !~',
 'if action=''provision'' and coalesce((p->>''password_login'')::boolean,false) then
  insert into erp_private.password_setup(user_id) values(target);
  update public.erp_cohorts set revision=revision+1 where id=c;
  insert into public.erp_audit(cohort_id,actor_id,action,entity_id) values(c,actor,''Mendaftarkan akun dengan wajib ganti password'',target);
  return jsonb_build_object(''ok'',true);
 end if;
 if exists(select 1 from erp_private.password_setup where user_id=target and completed_at is null) then raise exception ''Akun memakai password awal. Pemilik harus masuk dan mengganti password.''; end if;
 if p->>''hash'' !~');
 execute definition;
end $$;
commit;
