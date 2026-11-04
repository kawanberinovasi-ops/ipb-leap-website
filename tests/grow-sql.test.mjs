import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createDB,as,id} from './fixtures/database.mjs';
const migration=(await readdir(new URL('../supabase/migrations/',import.meta.url))).find(f=>f.endsWith('_grow_canvas_authenticated.sql'));
const schema=await readFile(new URL('../supabase/migrations/'+migration,import.meta.url),'utf8');
const catalog=JSON.parse(await readFile(new URL('../src/assets/grow/catalog.json',import.meta.url),'utf8'));
const canvas=()=>({goal:'TEST GOAL',why:'TEST WHY',reality:'TEST REALITY',options:'TEST OPTIONS',wayForward:'TEST WAY',mentorNeed:'TEST NEED',kpis:[{id:'socialBeneficiaries',baseline:'0',measurement:'TEST DOCUMENT',milestones:{3:'100 people',6:'250 people',9:'375 people',12:catalog.find(t=>t.id==='social').kpis.find(k=>k.id==='socialBeneficiaries').label}}]});
async function setup(){const db=await createDB();await db.exec(await readFile(new URL('../backend/erp/integrations/group-live-data.sql',import.meta.url),'utf8'));await db.exec(schema);await db.query("update erp_enrolments set field='Social & Community / Social Impact' where user_id=$1",[id(1)]);return db;}
async function state(db,role='mentee',u=id(1)){return(await db.query('select erp_grow_state($1,$2,$3) s',[id(20),u,role])).rows[0].s;}
async function cmd(db,role,action,data,expected){await as(db,role);return(await db.query('select erp_grow_command($1,$2,$3,$4::jsonb,$5) s',[id(20),id(1),action,JSON.stringify(data),expected??(await state(db,role)).revision])).rows[0].s;}
async function agree(db){await cmd(db,'mentee','canvas_submit',canvas());await cmd(db,'asmen','canvas_check',{decision:'Siap dibahas Mentor',comment:'TEST CHECK'});await cmd(db,'mentor','canvas_agree',{comment:'TEST AGREEMENT'});}
async function note(db){return(await cmd(db,'mentee','note_submit',{data:{date:'2025-01-02',due:'2025-01-04',learning:'TEST LEARNING',action:'TEST ACTION',kind:'1-on-1',format:'Online',time:'10:30'}})).notes.at(-1).id;}
async function complete(db,n){await cmd(db,'mentee','outcome_save',{id:n,status:'Selesai',result:'TEST RESULT',completed:'2025-01-04'});await cmd(db,'asmen','action_check',{id:n,execution:10,timeliness:10,evidence:5,comment:'TEST CHECK'});}
const review=()=>({period:3,items:[{id:'socialBeneficiaries',actual:'75 people',evidence:'TEST VERIFIABLE DOCUMENT',level:75,reason:'75 of 100'}]});
test('GROW identity, assignment, RPC-only tables, and draft privacy',async()=>{
 const db=await setup();try{
  await cmd(db,'mentee','canvas_save',{...canvas(),goal:'PRIVATE CANVAS'});await cmd(db,'mentee','note_save',{data:{date:'2025-01-02',learning:'PRIVATE NOTE'}});
  await as(db,'asmen');const s=await state(db,'asmen');assert.equal(s.canvas,null);assert.deepEqual(s.notes,[]);assert.ok(!JSON.stringify(s).includes('PRIVATE'));
  await assert.rejects(db.query('select * from erp_private.grow_workspaces'),/permission denied/);await assert.rejects(db.query('select * from erp_private.grow_events'),/permission denied/);
  await assert.rejects(state(db,'mentee'),/penugasan/);await assert.rejects(db.query('select erp_grow_command($1,$2,$3,$4::jsonb,$5)',[id(20),id(1),'note_submit','{}',2]),/penugasan/);
  for(const role of ['stranger','finance','system','manager']){await as(db,role);await assert.rejects(state(db,'mentor'),/penugasan/);}
  await as(db,'mentee','anon');await assert.rejects(state(db),/permission denied/);
  await as(db,'mentee');await db.exec('reset role');await db.query('update erp_profiles set active=false where id=$1',[id(1)]);await as(db,'mentee');await assert.rejects(state(db),/Akun/);
 }finally{await db.close();}
});
test('GROW full workflow, immutable publication, source invalidation and stale writes',async()=>{
 const db=await setup();try{
  await agree(db);const n=await note(db);await complete(db,n);await cmd(db,'mentor','review_save',review());
  await as(db,'mentor');assert.equal((await state(db,'mentor')).scores['3'].total,77.5);
  await as(db,'mentee');assert.equal((await state(db)).scores['3'].total,null,'private review does not leak before publication');assert.deepEqual((await state(db)).reviews,{});
  let s=await cmd(db,'mentor','publish',{period:3});assert.equal(s.publications.at(-1).score.total,77.5);
  await assert.rejects(cmd(db,'mentor','review_save',review(),0),/Data berubah/);
  await cmd(db,'mentee','outcome_save',{id:n,status:'Selesai',result:'UPDATED RESULT',completed:'2025-01-04'});
  await as(db,'mentor');s=await state(db,'mentor');assert.equal(s.scores['3'].total,null);assert.equal(s.publications.at(-1).score.total,77.5);
  await assert.rejects(cmd(db,'mentor','publish',{period:3}),/belum lengkap/);
  await as(db,'mentee');assert.equal((await state(db)).scores['3'].total,77.5,'mentee sees frozen published result');
 }finally{await db.close();}
});
test('GROW rejects forged KPI, role changes, inconsistent points and future publication',async()=>{
 const db=await setup();try{
  await assert.rejects(cmd(db,'mentee','canvas_submit',{...canvas(),kpis:[{...canvas().kpis[0],id:'businessClients'}]}),/katalog/);
  await assert.rejects(cmd(db,'mentee','canvas_submit',{...canvas(),kpis:[{...canvas().kpis[0],milestones:{...canvas().kpis[0].milestones,12:'forged'}}]}),/M12/);
  await agree(db);const n=await note(db);
  await assert.rejects(cmd(db,'mentee','action_check',{id:n,execution:10,timeliness:10,evidence:10,comment:'forge'}),/penugasan/);
  await assert.rejects(cmd(db,'asmen','action_check',{id:n,execution:10,timeliness:10,evidence:10,comment:'forge'}),/laporan/);
  await complete(db,n);await assert.rejects(cmd(db,'asmen','action_check',{id:n,execution:10,timeliness:5,evidence:10,comment:'forge'}),/setelah tenggat/);
  await cmd(db,'mentor','review_save',review());await db.exec('reset role');await db.query("update erp_cohorts set starts_on='2030-01-01',ends_on='2030-12-31' where id=$1",[id(20)]);
  await assert.rejects(cmd(db,'mentor','publish',{period:3}),/sebelum akhir milestone/);
 }finally{await db.close();}
});
test('multiple KPIs persist through agreement and every KPI is required for the published average',async()=>{
 const db=await setup();try{
  const c=canvas();c.kpis.push({id:'socialPrograms',baseline:'0',measurement:'VERIFIED PROGRAM REPORTS',milestones:{3:'1 program',6:'2 programs',9:'4 programs',12:catalog.find(t=>t.id==='social').kpis.find(k=>k.id==='socialPrograms').label}});
  let s=await cmd(db,'mentee','canvas_save',c);assert.equal(s.canvas.data.kpis.length,2);await as(db,'mentee');assert.deepEqual((await state(db)).canvas.data.kpis,c.kpis);
  await cmd(db,'mentee','canvas_submit',c);await cmd(db,'asmen','canvas_check',{decision:'Siap dibahas Mentor',comment:'BOTH KPIS COMPLETE'});s=await cmd(db,'mentor','canvas_agree',{comment:'TWO TARGETS AGREED'});assert.equal(s.canvas.data.kpis.length,2);
  const n=await note(db);await complete(db,n);await assert.rejects(cmd(db,'mentor','review_save',review()),/semua KPI/);
  const r=review();r.items.push({id:'socialPrograms',actual:'1 program',evidence:'PROGRAM REPORT',level:100,reason:'TARGET ACHIEVED'});await cmd(db,'mentor','review_save',r);s=await cmd(db,'mentor','publish',{period:3});assert.equal(s.publications.at(-1).score.mentor,61.25);assert.equal(s.publications.at(-1).score.total,86.25);assert.equal(s.publications.at(-1).review.items.length,2);
  await as(db,'mentee');s=await state(db);assert.equal(s.publications.at(-1).canvas.data.kpis.length,2);assert.equal(s.scores['3'].total,86.25);
 }finally{await db.close();}
});
