-- Permit placement before first login, without activating accounts or bypassing
-- the existing password/session gate. Disabled enrolments stay excluded.
begin;
alter table public.erp_groups drop constraint erp_groups_check;
alter table public.erp_groups add constraint erp_groups_check
 check (mentor_id is null or asmen_id is null or mentor_id<>asmen_id);

create function erp_private.profile_pending_activation(person uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from erp_private.password_setup where user_id=person and completed_at is null)
 or exists(select 1 from erp_private.activations where user_id=person and used_at is null and expires_at>now());
$$;
create function erp_private.profile_assignable(person uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from public.erp_profiles where id=person and (active or erp_private.profile_pending_activation(person)));
$$;
create function erp_private.group_ready(target uuid) returns boolean language sql stable set search_path='' as $$
 select coalesce((select
  exists(select 1 from public.erp_profiles p join public.erp_enrolments e on e.user_id=p.id where p.id=g.mentor_id and p.active and e.cohort_id=g.cohort_id and e.role='mentor' and e.active and 'mentor'=any(p.roles))
  and exists(select 1 from public.erp_profiles p join public.erp_enrolments e on e.user_id=p.id where p.id=g.asmen_id and p.active and e.cohort_id=g.cohort_id and e.role='asmen' and e.active and 'asmen'=any(p.roles))
  and (select count(*) from public.erp_group_members m join public.erp_profiles p on p.id=m.user_id join public.erp_enrolments e on e.user_id=p.id and e.cohort_id=g.cohort_id and e.role='mentee' where m.group_id=g.id and m.active and p.active and e.active and 'mentee'=any(p.roles))=5
 from public.erp_groups g where g.id=target),false);
$$;
revoke all on function erp_private.profile_pending_activation(uuid),erp_private.profile_assignable(uuid),erp_private.group_ready(uuid) from public,anon,authenticated;

create function erp_private.refresh_groups_after_profile_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.erp_groups g set active=erp_private.group_ready(g.id)
 where g.mentor_id=new.id or g.asmen_id=new.id or exists(select 1 from public.erp_group_members m where m.group_id=g.id and m.user_id=new.id and m.active);
 return new;
end $$;
revoke all on function erp_private.refresh_groups_after_profile_change() from public,anon,authenticated;
create trigger erp_group_profile_status after update of active,roles on public.erp_profiles for each row
 when (old.active is distinct from new.active or old.roles is distinct from new.roles)
 execute function erp_private.refresh_groups_after_profile_change();

do $patch$
declare definition text;
begin
 definition:=pg_get_functiondef('erp_private.management_workspace(uuid)'::regprocedure);
 if position('jsonb_agg(to_jsonb(p) order by p.display_name)' in definition)=0 then raise exception 'Unexpected management profile definition.'; end if;
 definition:=replace(definition,'jsonb_agg(to_jsonb(p) order by p.display_name)',
 'jsonb_agg((to_jsonb(p)||jsonb_build_object(''pending_activation'',not p.active and erp_private.profile_pending_activation(p.id))) order by p.display_name)');
 execute definition;

 definition:=pg_get_functiondef('erp_private.management_command(jsonb,integer)'::regprocedure);
 if position('h.id is null or not person.active' in definition)=0 or position('z.active and a.active and z.role=' in definition)=0 then raise exception 'Unexpected group placement definition.'; end if;
 definition:=replace(definition,'h.id is null or not person.active','h.id is null or not erp_private.profile_assignable(u)');
 definition:=replace(definition,'Kelompok dan track harus cocok; akun harus sudah diaktifkan.','Kelompok dan track harus cocok; pilih akun yang terdaftar.');
 definition:=replace(definition,'z.active and a.active and z.role=','z.active and erp_private.profile_assignable(a.id) and z.role=');
 definition:=replace(definition,'Pilih pendamping aktif dengan penugasan yang sesuai.','Pilih pendamping terdaftar dengan penugasan yang sesuai.');
 if position($old$update public.erp_groups k set active=(k.mentor_id is not null and k.asmen_id is not null and (select count(*) from public.erp_group_members m join public.erp_enrolments z on z.user_id=m.user_id and z.cohort_id=c and z.role='mentee' and z.active join public.erp_profiles n on n.id=m.user_id and n.active where m.group_id=k.id and m.active)=5) where k.cohort_id=c;$old$ in definition)=0 then raise exception 'Unexpected group readiness definition.'; end if;
 definition:=replace(definition,
 $old$update public.erp_groups k set active=(k.mentor_id is not null and k.asmen_id is not null and (select count(*) from public.erp_group_members m join public.erp_enrolments z on z.user_id=m.user_id and z.cohort_id=c and z.role='mentee' and z.active join public.erp_profiles n on n.id=m.user_id and n.active where m.group_id=k.id and m.active)=5) where k.cohort_id=c;$old$,
 '');
 definition:=replace(definition,$old$elsif p->>'action'='group' then$old$,
 $new$update public.erp_groups k set active=erp_private.group_ready(k.id) where k.cohort_id=c;
 elsif p->>'action'='group' then$new$);
 definition:=replace(definition,
 $old$update public.erp_groups set active=(mentor_id is not null and asmen_id is not null and (select count(*) from public.erp_group_members where group_id=g and active)=5) where id=g;$old$,
 $new$update public.erp_groups k set active=erp_private.group_ready(k.id) where k.id=g;$new$);
 execute definition;
end $patch$;
commit;
