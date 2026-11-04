import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDB,as,id} from './fixtures/database.mjs';
import {attendanceCSV,eligibleParticipants,exportName} from '../src/assets/attendance/export.mjs';
export async function eventDB(){const db=await createDB();await db.exec(`alter table auth.users add column encrypted_password text;alter table auth.sessions add column created_at timestamptz default now();
 alter table erp_private.activations add column user_id uuid,add column token_hash text,add column expires_at timestamptz,add column used_at timestamptz,add column created_by uuid;alter table erp_private.activations alter column id set default gen_random_uuid();
 create or replace function erp_private.ensure_profile() returns jsonb language plpgsql security definer set search_path='' as $$declare p public.erp_profiles;begin if not erp_private.session_valid() then raise exception 'Sesi akun belum terverifikasi.';end if;select * into p from public.erp_profiles where id=auth.uid();return to_jsonb(p);end$$;`);
 for(const f of ['management-attendance','managed-accounts','enrolment-pathway-optional','initial-password','group-planning','portal-announcements-calendar'])await db.exec(await readFile(new URL('../backend/erp/integrations/'+f+'.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261104154305_event_attendance_team.sql',import.meta.url),'utf8'));await db.exec(await readFile(new URL('../supabase/migrations/20261104154627_event_registration_audit.sql',import.meta.url),'utf8'));return db;}
const call=async(db,a,p)=>(await db.query('select erp_attendance_command($1,$2::jsonb) result',[a,JSON.stringify(p)])).rows[0].result;
const workspace=async db=>(await db.query('select erp_attendance_workspace($1) w',[id(20)])).rows[0].w;
const activity={id:id(300),cohort:id(20),name:'TEST ONLY event',kind:'Event',participants:[id(1),id(2)],starts_at:'2020-01-01T00:00:00Z',ends_at:'2040-01-01T00:00:00Z'};
async function eventOperator(db){await db.exec('reset role');await db.query("update erp_profiles set roles=ARRAY['event'] where id=$1",[id(8)]);await db.query("insert into erp_enrolments(cohort_id,user_id,role)values($1,$2,'event')",[id(20),id(8)]);await db.query("insert into erp_private.event_staff(cohort_id,user_id,division) values($1,$2,'Operation & Communication')",[id(20),id(8)]);await as(db,'stranger');}
test('Event can create activities, record pending Mentee/Asmen and read activity rosters without broader permissions',async t=>{
 const db=await eventDB();t.after(()=>db.close());await db.query('update erp_profiles set active=false where id in ($1,$2)',[id(1),id(2)]);await db.query('insert into erp_private.password_setup(user_id)values($1),($2)',[id(1),id(2)]);
 await eventOperator(db);const w=await workspace(db);assert.equal(w.canAttendManage,true);assert.equal(w.division,'Operation & Communication');assert.equal(eligibleParticipants(w,id(20)).length,2);assert.ok(!JSON.stringify(w).includes('versions'));
 await call(db,'event',activity);assert.equal((await call(db,'event',activity)).duplicate,true);
 await call(db,'correct',{event:id(300),mentee:id(2),expected:0,status:'Hadir',reason:'TEST ONLY daftar hadir lapangan'});
 const result=await call(db,'state',{cohort:id(20)});assert.equal(result.participants.length,2);assert.equal(result.attendance[0].status,'Hadir');assert.equal(result.history.length,1);
 assert.equal((await db.query('select active from erp_profiles where id=$1',[id(2)])).rows[0]?.active,undefined); // Direct RLS cannot expose another profile.
 await assert.rejects(db.query('select erp_management_workspace($1)',[id(20)]),/ditugaskan/);
 await assert.rejects(db.query("select erp_portal_command($1::jsonb)",[JSON.stringify({action:'publish',cohort:id(20),id:id(399),title:'TEST',body:'TEST',all:true})]),/pengelola/);
 await assert.rejects(db.query('select * from erp_attendance'),/permission denied/);await assert.rejects(db.query('select * from erp_private.event_staff'),/permission denied/);
 await assert.rejects(call(db,'event',{...activity,id:id(301),cohort:id(99)}),/ditugaskan/);
 await db.exec('reset role');assert.equal((await db.query('select active from erp_profiles where id=$1',[id(2)])).rows[0].active,false);
 await db.query('update erp_private.event_staff set active=false where user_id=$1',[id(8)]);await as(db,'stranger');await assert.rejects(call(db,'state',{cohort:id(20)}),/diakses/);
});
test('Asmen own QR/history works; disabled, cross-cohort and role mismatches remain excluded',async t=>{
 const db=await eventDB();t.after(()=>db.close());await as(db,'manager');await call(db,'event',activity);
 await as(db,'asmen');const own=await workspace(db);assert.equal(own.canAttendManage,false);assert.equal(own.profiles.length,1);const card=await call(db,'card',{cohort:id(20)});assert.match(card.payload,/^ipbleap:attendance:v1:/);await assert.rejects(call(db,'card',{cohort:id(20),mentee:id(1)}),/diakses/);
 await as(db,'manager');await call(db,'scan',{event:id(300),payload:card.payload});await as(db,'asmen');const ownState=await call(db,'state',{cohort:id(20)});assert.equal(ownState.participants.length,1);assert.equal(ownState.attendance[0].user_id,id(2));
 await as(db,'manager');await assert.rejects(call(db,'event',{...activity,id:id(302),participants:[id(3)]}),/Peserta/);await assert.rejects(call(db,'event',{...activity,id:id(303),participants:[id(1),id(1)]}),/berbeda/);
 await db.exec('reset role');await db.query('update erp_profiles set active=false where id=$1',[id(1)]);await as(db,'manager');await assert.rejects(call(db,'event',{...activity,id:id(304)}),/Peserta/);
 const portal=(await db.query('select erp_portal_workspace($1) w',[id(20)])).rows[0].w;assert.equal(portal.activities[0].title,activity.name);
});
test('Only Super Admin provisions Event role/division and password setup remains mandatory',async t=>{
 const db=await eventDB();t.after(()=>db.close());const p={actor:id(6),session:id(106),cohort:id(20),operation:'create',roles:['event'],division:'Operation & Communication',expected:0,user:id(500),email:'testevent@example.test',name:'TEST Event',password_login:true};
 await db.query('insert into auth.users(id,email,email_confirmed_at,encrypted_password)values($1,$2,now(),$3)',[p.user,p.email,'TEST initial hash']);
 const service=async p=>(await db.query("select erp_managed_account_service('provision',$1::jsonb) result",[JSON.stringify(p)])).rows[0].result;
 await as(db,'manager','service_role');await assert.rejects(service({...p,actor:id(9),session:id(109)}),/Super Admin/);
 await as(db,'system','service_role');await assert.rejects(service({...p,division:''}),/divisi/);await service(p);await db.exec('reset role');assert.equal((await db.query('select division from erp_private.event_staff where user_id=$1',[p.user])).rows[0].division,p.division);assert.equal((await db.query('select active from erp_profiles where id=$1',[p.user])).rows[0].active,false);assert.equal((await db.query('select count(*)::int n from erp_private.password_setup where user_id=$1 and completed_at is null',[p.user])).rows[0].n,1);
});
test('CSV exports one activity, preserves unknown attendance and escapes spreadsheet formulas',()=>{
 const event={...activity,cohort_id:id(20)},other={event_id:id(301),user_id:id(1),display_name:'DO NOT EXPORT'};
 const state={cohorts:[{id:id(20),name:'Batch 1'}],profiles:[{id:id(1),email:'test@example.test',roles:['mentee'],active:false,pending_activation:true}],enrolments:[{cohort_id:id(20),user_id:id(1),role:'mentee',active:true}]};
 const data={participants:[{event_id:event.id,user_id:id(1),display_name:'=HYPERLINK("bad")'},other],attendance:[],token:'secret QR NEVER EXPORT'};
 const csv=attendanceCSV(event,data,state);assert.ok(csv.startsWith('\ufeff'));assert.match(csv,/Belum tercatat/);assert.match(csv,/Belum aktivasi/);assert.ok(csv.includes("'=HYPERLINK"));assert.ok(!csv.includes('DO NOT EXPORT'));assert.ok(!csv.includes('secret'));assert.equal(csv.split('\r\n').length,3);assert.ok(exportName(event).endsWith('.csv'));
});

test('Admin registration records service assignment time without inventing a human actor',async t=>{const db=await eventDB();t.after(()=>db.close());await db.exec('alter table erp_audit alter column actor_id set not null');const p={user:id(550),email:'service-event@example.test',cohort:id(20),division:'Operation & Communication'};await db.query('insert into auth.users(id,email,email_confirmed_at)values($1,$2,now())',[p.user,p.email]);await as(db,'manager');await assert.rejects(db.query('select erp_event_account_service($1::jsonb)',[JSON.stringify(p)]),/permission denied/);await as(db,'system','service_role');await db.query('select erp_event_account_service($1::jsonb)',[JSON.stringify(p)]);await db.exec('reset role');assert.ok((await db.query('select created_at from erp_private.event_staff where user_id=$1',[p.user])).rows[0].created_at);assert.equal((await db.query('select active from erp_profiles where id=$1',[p.user])).rows[0].active,false);});
