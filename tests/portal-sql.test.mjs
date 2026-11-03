import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createDB,as,id} from './fixtures/database.mjs';
async function setup(t){const db=await createDB();t.after(()=>db.close());for(const f of ['management-attendance.sql','portal-announcements-calendar.sql'])await db.exec(await readFile(new URL('../backend/erp/integrations/'+f,import.meta.url),'utf8'));await db.query("insert into erp_enrolments(cohort_id,user_id,role)values($1,$2,'mentee')",[id(20),id(7)]);return db;}
const call=(db,p)=>db.query('select erp_portal_command($1::jsonb) as r',[JSON.stringify({cohort:id(20),...p})]).then(x=>x.rows[0].r);
const ws=db=>db.query('select erp_portal_workspace($1) as r',[id(20)]).then(x=>x.rows[0].r);
const announcement={action:'publish',id:id(300),title:'TEST Published',body:'TEST only announcement',roles:['mentee'],pinned:true};
test('portal announcements publish → read → withdraw; scoped audiences, schedules, idempotency and immutable history',async t=>{
 const db=await setup(t);await as(db,'manager');await call(db,announcement);assert.equal((await call(db,announcement)).duplicate,true);await assert.rejects(call(db,{...announcement,title:'conflicting'}),/ID pengumuman/);
 await call(db,{...announcement,id:id(301),roles:[],groups:[id(21)],title:'TEST group'});await call(db,{...announcement,id:id(302),publish_at:'2040-01-01T00:00:00Z',title:'TEST future'});
 await as(db,'mentee');let own=await ws(db);assert.equal(own.announcements.length,2);assert.ok(!JSON.stringify(own).includes('TEST future'));assert.equal(own.profiles.find(p=>p.id===id(3)).display_name,'mentor');assert.equal('email' in own.profiles[0],false);
 await as(db,'observer');own=await ws(db);assert.deepEqual(own.announcements.map(a=>a.id),[id(300)]);
 await as(db,'mentor');assert.deepEqual((await ws(db)).announcements.map(a=>a.id),[id(301)]);
 await as(db,'manager');await call(db,{action:'withdraw',id:id(300),expected:1});await assert.rejects(call(db,{action:'withdraw',id:id(300),expected:1}),/Data berubah/);
 await as(db,'mentee');assert.deepEqual((await ws(db)).announcements.map(a=>a.id),[id(301)]);
 await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from erp_announcement_history')).rows[0].n,4);assert.equal((await db.query('select body from erp_announcements where id=$1',[id(300)])).rows[0].body,announcement.body);
});
test('portal cannot publish as mentee/mentor/finance or leak across cohort; direct access is denied',async t=>{
 const db=await setup(t);for(const actor of ['mentee','asmen','mentor','finance','assessor','observer']){await as(db,actor);await assert.rejects(call(db,announcement),/Hanya pengelola/);await assert.rejects(db.query('select * from erp_announcements'),/permission denied/);}
 await as(db,'stranger');await assert.rejects(ws(db),/diakses/);await as(db,'manager');await assert.rejects(call(db,{...announcement,groups:[id(99)]}),/Penerima/);await assert.rejects(call(db,{...announcement,users:[id(8)]}),/Penerima/);await assert.rejects(call(db,{...announcement,cohort:id(99)}),/diakses/);
});
test('personal calendar is owner-only, persists, retries without duplication and cancels with revision checks',async t=>{
 const db=await setup(t);const event={action:'personal_save',id:id(400),title:'PRIVATE calendar item',starts_at:'2026-11-04T02:00:00Z',ends_at:'2026-11-04T03:00:00Z',location:'TEST location'};
 await as(db,'mentee');await call(db,event);assert.equal((await call(db,event)).duplicate,true);assert.equal((await ws(db)).activities.find(e=>e.id===id(400)).title,event.title);
 await as(db,'manager');assert.ok(!(await ws(db)).activities.some(e=>e.id===id(400)));await assert.rejects(call(db,{action:'personal_cancel',id:id(400),expected:1}),/pemilik/);
 await as(db,'mentee');await call(db,{action:'personal_cancel',id:id(400),expected:1});assert.equal((await ws(db)).activities.find(e=>e.id===id(400)).cancelled,true);await assert.rejects(call(db,{action:'personal_cancel',id:id(400),expected:1}),/Data berubah/);
});
