create or replace function erp_private.can_cohort(p_cohort uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.erp_cohorts c where c.id=p_cohort and (
  erp_private.manages(c.id) or erp_private.assesses(c.id)
  or (erp_private.session_valid() and exists(select 1 from public.erp_enrolments e join public.erp_profiles p on p.id=e.user_id where e.cohort_id=c.id and e.user_id=auth.uid() and e.active and p.active and e.role=any(p.roles)))
 ));
$$;
create or replace function erp_private.can_subject(p_cohort uuid,p_mentee uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.erp_enrolments e where e.cohort_id=p_cohort and e.user_id=p_mentee and e.role='mentee' and e.active)
 and ((erp_private.has_role('mentee') and auth.uid()=p_mentee)
 or erp_private.staff_for(p_cohort,p_mentee,'mentor') or erp_private.staff_for(p_cohort,p_mentee,'asmen') or erp_private.assesses(p_cohort));
$$;
