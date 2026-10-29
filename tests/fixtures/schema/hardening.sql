create or replace function erp_private.session_valid() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from auth.users u join auth.sessions s on s.user_id=u.id where u.id=auth.uid() and u.email_confirmed_at is not null and s.id::text=auth.jwt()->>'session_id' and (s.not_after is null or s.not_after>now()));
$$;
create or replace function erp_private.can_group(p_group uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.erp_groups g where g.id=p_group and (erp_private.manages(g.cohort_id) or erp_private.assesses(g.cohort_id)
 or (erp_private.has_role('mentor') and g.mentor_id=auth.uid() and exists(select 1 from public.erp_enrolments e where e.cohort_id=g.cohort_id and e.user_id=auth.uid() and e.role='mentor' and e.active))
 or (erp_private.has_role('asmen') and g.asmen_id=auth.uid() and exists(select 1 from public.erp_enrolments e where e.cohort_id=g.cohort_id and e.user_id=auth.uid() and e.role='asmen' and e.active))
 or (erp_private.has_role('mentee') and exists(select 1 from public.erp_enrolments e where e.cohort_id=g.cohort_id and e.user_id=auth.uid() and e.role='mentee' and e.active) and exists(select 1 from public.erp_group_members m where m.group_id=g.id and m.user_id=auth.uid() and m.active))));
$$;
create or replace function erp_private.can_profile(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select erp_private.session_valid() and (p_user=auth.uid() or erp_private.has_role('system')
 or exists(select 1 from public.erp_enrolments e where e.user_id=p_user and e.active and (erp_private.manages(e.cohort_id) or erp_private.can_subject(e.cohort_id,p_user)))
 or exists(select 1 from public.erp_cohort_staff s where s.user_id=p_user and erp_private.manages(s.cohort_id))
 or exists(select 1 from public.erp_groups g where erp_private.can_group(g.id) and (g.mentor_id=p_user or g.asmen_id=p_user)));
$$;
-- Private state is inaccessible directly. Explicit deny policies document the intended default deny.
create policy private_settings_no_client on erp_private.settings for all to anon,authenticated using(false) with check(false);
create policy private_activations_no_client on erp_private.activations for all to anon,authenticated using(false) with check(false);
create policy private_requests_no_client on erp_private.requests for all to anon,authenticated using(false) with check(false);
create policy private_revisions_no_client on erp_private.subject_revisions for all to anon,authenticated using(false) with check(false);
revoke all on all tables in schema erp_private from anon,authenticated;
