create function erp_private.check_record_reference() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.session_id is not null then
  if new.kind not in ('checkin','mentoring') or not exists(select 1 from public.erp_sessions s where s.id=new.session_id and s.cohort_id=new.cohort_id and s.month_no=new.month_no and s.kind=new.kind and new.mentee_id=any(s.participant_ids)) then raise exception 'Jadwal tidak sesuai cohort, kegiatan, bulan, atau peserta.'; end if;
 end if;
 return new;
end;$$;
revoke all on function erp_private.check_record_reference() from public,anon,authenticated;
create trigger record_reference before insert or update of cohort_id,mentee_id,kind,month_no,session_id on public.erp_records for each row execute function erp_private.check_record_reference();
