import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDB,as,id} from './fixtures/database.mjs';

async function setup(t){const db=await createDB();t.after(()=>db.close());await db.exec(await readFile(new URL('../backend/erp/integrations/management-attendance.sql',import.meta.url),'utf8'));return db;}
const payload={id:id(300),cohort:id(20),name:'TEST ONLY Common Class',kind:'Common Class',participants:[id(1)],starts_at:'2020-01-01T00:00:00Z',ends_at:'2040-01-01T00:00:00Z'};
const call=(db,action,p)=>(db.query('select erp_attendance_command($1,$2::jsonb) as result',[action,JSON.stringify(p)])).then(r=>r.rows[0].result);

test('production attendance: assigned operator, own QR/history, idempotent scan, correction conflicts and closed windows',async t=>{
 const db=await setup(t);await as(db,'manager');await call(db,'event',payload);
 assert.equal((await call(db,'event',payload)).duplicate,true);
 await assert.rejects(call(db,'event',{...payload,name:'OTHER'}),/ID kegiatan/);
 await as(db,'mentee');const card=await call(db,'card',{cohort:id(20)});assert.match(card.payload,/^ipbleap:attendance:v1:[a-f0-9]{64}$/);
 await assert.rejects(call(db,'event',payload),/ditugaskan/);
 await assert.rejects(call(db,'scan',{event:payload.id,payload:card.payload}),/dikelola/);
 await as(db,'manager');const result=await call(db,'scan',{event:payload.id,payload:card.payload});assert.equal(result.attendance.status,'Hadir');
 const duplicate=await call(db,'scan',{event:payload.id,payload:card.payload});assert.equal(duplicate.duplicate,true);assert.equal(duplicate.attendance.recorded_at,result.attendance.recorded_at);
 await assert.rejects(call(db,'correct',{event:payload.id,mentee:id(1),expected:1,status:'Izin',reason:'no'}),/alasan/);
 await call(db,'correct',{event:payload.id,mentee:id(1),expected:1,status:'Izin',reason:'TEST ONLY correction'});
 await assert.rejects(call(db,'scan',{event:payload.id,payload:card.payload}),/koreksi/);
 await assert.rejects(call(db,'correct',{event:payload.id,mentee:id(1),expected:1,status:'Absen',reason:'TEST ONLY stale'}),/Data berubah/);
 await as(db,'mentee');const own=await call(db,'state',{cohort:id(20)});assert.equal(own.attendance[0].status,'Izin');assert.equal(own.history.length,2);
 await assert.rejects(call(db,'card',{cohort:id(20),mentee:id(8)}),/diakses/);
 await as(db,'manager');await call(db,'close',{event:payload.id,expected:1});await assert.rejects(call(db,'scan',{event:payload.id,payload:card.payload}),/ditutup/);
 await assert.rejects(call(db,'close',{event:payload.id,expected:1}),/Data berubah/);
});
test('production attendance rejects other roles/cohorts/inactive accounts and direct table access',async t=>{
 const db=await setup(t);await as(db,'manager');await call(db,'event',payload);const card=await call(db,'card',{cohort:id(20),mentee:id(1)});
 for(const role of ['finance','mentor','asmen','assessor','stranger','system']){await as(db,role);await assert.rejects(call(db,'state',{cohort:id(20)}),/diakses/);await assert.rejects(call(db,'event',{...payload,id:id(301)}),/ditugaskan/);await assert.rejects(db.query('select * from erp_attendance'),/permission denied/);}
 await as(db,'manager');await assert.rejects(call(db,'event',{...payload,id:id(301),participants:[id(8)]}),/Peserta/);await assert.rejects(call(db,'state',{cohort:id(99)}),/diakses/);await assert.rejects(call(db,'scan',{event:id(300),payload:'bad'}),/QR/);
 await db.exec('reset role');await db.query('update erp_enrolments set active=false where user_id=$1',[id(1)]);await as(db,'manager');await assert.rejects(call(db,'scan',{event:id(300),payload:card.payload}),/tidak aktif/);
});
test('management returns metadata only, enforces revisions, and cannot grant roles or mutate shared identities',async t=>{
 const db=await setup(t);await db.query("update erp_groups set field='Entrepreneur / Business'");await db.query("insert into erp_records(id,cohort_id,mentee_id,kind,month_no,latest_version) values($1,$2,$3,'mentoring',3,1)",[id(400),id(20),id(1)]);
 await db.query("insert into erp_versions(record_id,number,status,data,actor_id,action)values($1,1,'Draft',$2::jsonb,$3,'save')",[id(400),JSON.stringify({insight:'PRIVATE MUST NOT LEAK'}),id(1)]);
 await as(db,'manager');let w=(await db.query('select erp_management_workspace($1) as w',[id(20)])).rows[0].w;assert.equal(w.records[0].latest_status,'Draft');assert.ok(!JSON.stringify(w).includes('PRIVATE MUST NOT LEAK'));assert.equal(w.records[0].versions[0].data,undefined);
 const update={action:'account',cohort:id(20),user:id(1),role:'mentee',email:'mentee@example.test',display_name:'mentee',field:'Entrepreneur / Business',pathway:'Grow',active:true,group_id:''};
 await db.query('select erp_management_command($1,0)',[JSON.stringify(update)]);
 await assert.rejects(db.query('select erp_management_command($1,0)',[JSON.stringify(update)]),/Data berubah/);
 await assert.rejects(db.query('select erp_management_command($1,1)',[JSON.stringify({...update,email:'changed@example.test'})]),/Email login/);
 await assert.rejects(db.query('select erp_management_command($1,1)',[JSON.stringify({...update,user:id(6),role:'system'})]),/Akun tidak/);
 for(const role of ['finance','mentee','mentor','asmen','assessor']){await as(db,role);await assert.rejects(db.query('select erp_management_workspace($1)',[id(20)]),/ditugaskan/);}
});

test('managed Auth provisioning is service-only, scoped to assigned cohort, non-escalating and versioned',async t=>{
 const db=await setup(t);await db.exec(`alter table erp_private.activations add column user_id uuid,add column token_hash text,add column expires_at timestamptz,add column used_at timestamptz,add column created_by uuid;alter table erp_private.activations alter column id set default gen_random_uuid();`);
 await db.exec(await readFile(new URL('../backend/erp/integrations/managed-accounts.sql',import.meta.url),'utf8'));
 const service=async(action,p)=>(await db.query('select erp_managed_account_service($1,$2::jsonb) as result',[action,JSON.stringify(p)])).rows[0].result;
 const p={actor:id(9),session:id(109),cohort:id(20),operation:'create',roles:['mentee'],field:'Entrepreneur / Business',pathway:'Grow',expected:0,user:id(500),email:'new@example.test',name:'TEST NEW',hash:'a'.repeat(64)};
 await as(db,'manager');await assert.rejects(service('authorize',p),/permission denied/);
 await db.exec('reset role');await db.query("insert into auth.users(id,email,email_confirmed_at)values($1,'new@example.test',now())",[id(500)]);
 await as(db,'manager','service_role');await service('authorize',p);
 await assert.rejects(service('authorize',{...p,roles:['system']}),/Super Admin/);
 await assert.rejects(service('authorize',{...p,cohort:id(99)}),/ditugaskan/);
 await assert.rejects(service('authorize',{...p,session:id(99)}),/Sesi/);
 await assert.rejects(service('authorize',{...p,pathway:'Produce'}),/track/);
 await service('provision',p);
 await db.exec('reset role');const person=(await db.query('select * from erp_profiles where id=$1',[id(500)])).rows[0];assert.equal(person.active,false);assert.deepEqual(person.roles,['mentee']);assert.equal((await db.query('select * from erp_enrolments where user_id=$1',[id(500)])).rows.length,1);
 await as(db,'manager','service_role');await service('reissue',{...p,operation:'reissue',hash:'b'.repeat(64)});
 await assert.rejects(service('reissue',{...p,operation:'reissue',user:id(6)}),/kewenangan/);
 await db.exec('reset role');const tokens=(await db.query('select * from erp_private.activations order by expires_at')).rows;assert.equal(tokens.length,2);assert.ok(tokens[0].used_at);assert.equal(tokens[1].used_at,null);
});
