-- Registration may precede pathway selection. POC validation remains unchanged.
begin;
create function erp_private.enrolment_track_valid(field text,pathway text) returns boolean language sql immutable set search_path='' as $$
 select coalesce(field in ('Entrepreneur / Business','Academic & Research','Professional / Corporate / Bureaucracy','Politics / Public Leadership','Social & Community / Social Impact')
 and (coalesce(pathway,'')='' or erp_private.track_pathway_valid(field,pathway)),false)
$$;
revoke all on function erp_private.enrolment_track_valid(text,text) from public,anon,authenticated;
do $$
declare target regprocedure; definition text;
begin
 foreach target in array array['erp_private.managed_account_service(text,jsonb)'::regprocedure,'erp_private.management_command(jsonb,integer)'::regprocedure] loop
  definition:=pg_get_functiondef(target);
  if position('erp_private.track_pathway_valid(p->>''field'',p->>''pathway'')' in definition)=0 then raise exception 'Registration validation differs from expected definition.'; end if;
  definition:=replace(definition,'erp_private.track_pathway_valid(p->>''field'',p->>''pathway'')','erp_private.enrolment_track_valid(p->>''field'',p->>''pathway'')');
  definition:=replace(definition,'Isi track dan pathway peserta.','Pilih track peserta dan pathway yang sesuai bila sudah ditetapkan.');
  execute definition;
 end loop;
end $$;
commit;
