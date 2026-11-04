begin;
do $test$
declare users uuid[]:=array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];sessions uuid[]:=array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];roles text[]:=array['mentee','asmen','mentor'];c uuid:=gen_random_uuid();g uuid:=gen_random_uuid();i integer;s jsonb;d jsonb;n text;rev integer:=0;target text;
begin
 for i in 1..3 loop
  insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values(users[i],users[i]::text||'@grow-rollback.invalid',now(),'{"provider":"email","providers":["email"]}','{}',now(),now());
  insert into auth.sessions(id,user_id,created_at,updated_at)values(sessions[i],users[i],now(),now());
  insert into public.erp_profiles(id,display_name,email,roles,active)values(users[i],'TRANSACTION ROLLBACK CHECK',users[i]::text||'@grow-rollback.invalid',array[roles[i]],true) on conflict(id) do update set roles=excluded.roles,active=true;
 end loop;
 insert into public.erp_cohorts(id,name,starts_on,ends_on,created_by)values(c,'GROW ROLLBACK CHECK '||c::text,'2025-01-01','2025-12-31',users[3]);
 for i in 1..3 loop insert into public.erp_enrolments(cohort_id,user_id,role,field)values(c,users[i],roles[i],'Social & Community / Social Impact');end loop;
 insert into public.erp_groups(id,cohort_id,name,field,mentor_id,asmen_id,active)values(g,c,'GROW ROLLBACK CHECK','Social & Community / Social Impact',users[3],users[2],false);
 insert into public.erp_group_members(group_id,user_id)values(g,users[1]);
 select x->>'label' into target from jsonb_array_elements(erp_private.grow_catalog('social')->'kpis')x where x->>'id'='socialBeneficiaries';
 d:=jsonb_build_object('goal','ROLLBACK GOAL','why','ROLLBACK WHY','reality','ROLLBACK REALITY','options','ROLLBACK OPTIONS','wayForward','ROLLBACK WAY','mentorNeed','Tidak ada','kpis',jsonb_build_array(jsonb_build_object('id','socialBeneficiaries','baseline','0','measurement','ROLLBACK DOCUMENTS','milestones',jsonb_build_object('3','100 people','6','250 people','9','375 people','12',target))));
 perform set_config('request.jwt.claims',jsonb_build_object('sub',users[1],'session_id',sessions[1],'role','authenticated')::text,true);
 s:=public.erp_grow_command(c,users[1],'canvas_submit',d,rev);rev:=(s->>'revision')::int;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',users[2],'session_id',sessions[2],'role','authenticated')::text,true);
 s:=public.erp_grow_command(c,users[1],'canvas_check','{"decision":"Siap dibahas Mentor","comment":"ROLLBACK CHECK"}',rev);rev:=(s->>'revision')::int;
 begin perform public.erp_grow_state(c,users[1],'mentor');raise exception 'ROLE ISOLATION FAILED';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',users[3],'session_id',sessions[3],'role','authenticated')::text,true);
 s:=public.erp_grow_command(c,users[1],'canvas_agree','{"comment":"ROLLBACK AGREEMENT"}',rev);rev:=(s->>'revision')::int;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',users[1],'session_id',sessions[1],'role','authenticated')::text,true);
 s:=public.erp_grow_command(c,users[1],'note_submit','{"data":{"date":"2025-01-02","due":"2025-01-04","learning":"ROLLBACK LEARNING","action":"ROLLBACK ACTION"}}',rev);rev:=(s->>'revision')::int;n:=s->'notes'->0->>'id';
 s:=public.erp_grow_command(c,users[1],'outcome_save',jsonb_build_object('id',n,'status','Selesai','result','ROLLBACK RESULT','completed','2025-01-04'),rev);rev:=(s->>'revision')::int;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',users[2],'session_id',sessions[2],'role','authenticated')::text,true);
 s:=public.erp_grow_command(c,users[1],'action_check',jsonb_build_object('id',n,'execution',10,'timeliness',10,'evidence',5,'comment','ROLLBACK ASMEN'),rev);rev:=(s->>'revision')::int;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',users[3],'session_id',sessions[3],'role','authenticated')::text,true);
 s:=public.erp_grow_command(c,users[1],'review_save','{"period":3,"items":[{"id":"socialBeneficiaries","actual":"75 people","evidence":"ROLLBACK DOCUMENTS","reason":"75 of 100","level":75}]}',rev);rev:=(s->>'revision')::int;
 s:=public.erp_grow_command(c,users[1],'publish','{"period":3}',rev);
 if (s#>>'{publications,0,score,total}')::numeric<>77.5 then raise exception 'PUBLICATION SCORE FAILED';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',users[1],'session_id',sessions[1],'role','authenticated')::text,true);
 s:=public.erp_grow_state(c,users[1],'mentee');if (s#>>'{scores,3,total}')::numeric<>77.5 then raise exception 'MENTEE READBACK FAILED';end if;
end $test$;
rollback;
select jsonb_build_object('result','PASS: submit-check-agree-note-outcome-score-publish-readback; transaction rolled back','profiles',(select count(*) from public.erp_profiles),'grow_workspaces',(select count(*) from erp_private.grow_workspaces),'grow_events',(select count(*) from erp_private.grow_events),'temporary_users',(select count(*) from auth.users where email like '%@grow-rollback.invalid')) as smoke_test;
