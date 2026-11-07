import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createDB,as,id} from './fixtures/database.mjs';
const migrations=new URL('../supabase/migrations/',import.meta.url);
const file=(await readdir(migrations)).find(n=>n.endsWith('_grow_context_performance.sql'));
const sql=await readFile(new URL(file,migrations),'utf8');
const read=async(db,c=id(20))=>(await db.query('select erp_grow_context($1) c',[c])).rows[0].c;
async function setup(){
 const db=await createDB();
 await db.exec(await readFile(new URL('../backend/erp/integrations/group-live-data.sql',import.meta.url),'utf8'));
 const grow=(await readdir(migrations)).find(n=>n.endsWith('_grow_canvas_authenticated.sql'));
 await db.exec(await readFile(new URL(grow,migrations),'utf8'));
 await db.exec('alter table erp_groups add column archived_at timestamptz');
 await db.exec(sql);
 await db.query("update erp_enrolments set field='Social & Community / Social Impact' where user_id=$1",[id(1)]);
 await db.query('insert into erp_enrolments(cohort_id,user_id,role)values($1,$2,$3)',[id(20),id(7),'mentee']);
 await db.query('insert into erp_group_members(group_id,user_id) values($1,$2)',[id(21),id(7)]);
 return db;
}
test('GROW context loads only authorized roster metadata, without drafts, old records, audit or emails',async t=>{
 const db=await setup();t.after(()=>db.close());
 await as(db,'mentee');
 const own=await read(db);
 assert.deepEqual(own.members.map(m=>m.user_id),[id(1)]);
 assert.deepEqual(own.profiles.map(p=>p.id),[id(1)]);
 for(const role of ['asmen','mentor']){
  await as(db,role);const roster=await read(db);
  assert.equal(roster.selectedCohort,id(20));assert.equal(roster.groups.length,1);
  assert.deepEqual(roster.members.map(m=>m.user_id).sort(),[id(1),id(7)]);
  assert.deepEqual(roster.enrolments.filter(e=>e.role==='mentee').map(e=>e.user_id).sort(),[id(1),id(7)]);
  assert.ok(roster.profiles.every(p=>Object.keys(p).sort().join(',')==='display_name,id'));
  assert.deepEqual(Object.keys(roster).sort(),['cohorts','enrolments','groups','members','profiles','selectedCohort']);
 }
 await as(db,'stranger');await assert.rejects(read(db),/tidak dapat diakses/);
 await as(db,'mentee','anon');await assert.rejects(read(db),/permission denied/);
});
test('GROW context keeps incomplete groups accessible, excludes archived or inactive assignments and denies foreign batches',async t=>{
 const db=await setup();t.after(()=>db.close());
 await db.query('update erp_groups set active=false where id=$1',[id(21)]);
 await as(db,'mentor');assert.equal((await read(db)).members.length,2);
 await assert.rejects(read(db,id(99)),/tidak dapat diakses/);
 await db.exec('reset role');await db.query('update erp_enrolments set active=false where user_id=$1',[id(7)]);
 await as(db,'mentor');assert.deepEqual((await read(db)).members.map(m=>m.user_id),[id(1)]);
 await db.exec('reset role');await db.query('update erp_groups set archived_at=now() where id=$1',[id(21)]);
 await as(db,'mentor');const empty=await read(db);assert.deepEqual(empty.groups,[]);assert.deepEqual(empty.members,[]);
 await db.exec('reset role');await db.query('update erp_profiles set active=false where id=$1',[id(3)]);
 await as(db,'mentor');await assert.rejects(read(db),/Sesi akun/);
});
test('GROW context is read only and avoids the nested global profile permission scan',async t=>{
 const db=await setup();t.after(()=>db.close());
 await as(db,'mentee');await db.exec('begin read only');
 assert.equal((await read(db,null)).selectedCohort,id(20));await db.exec('rollback');
 await db.exec('reset role');
 // An unrelated profile must not trigger global authorization work on every page.
 await db.exec("create or replace function erp_private.can_profile(p_user uuid) returns boolean language plpgsql as $$begin raise exception 'GLOBAL PROFILE SCAN';end$$");
 await as(db,'mentee');assert.equal((await read(db)).profiles.length,1);
});
test('a stale GROW save returns a terminal conflict and preserves the saved version',async t=>{
 const db=await setup();t.after(()=>db.close());await as(db,'mentee');
 const command=(data,revision)=>db.query("select erp_grow_command($1,$2,'canvas_save',$3, $4) s",[id(20),id(1),JSON.stringify(data),revision]);
 const saved=(await command({goal:'SAVED VERSION',kpis:[]},0)).rows[0].s;
 for(let i=0;i<3;i++)await assert.rejects(command({goal:'STALE VERSION',kpis:[]},0),e=>e.code==='PT409'&&/Data berubah/.test(e.message));
 const current=(await db.query("select erp_grow_state($1,$2,'mentee') s",[id(20),id(1)])).rows[0].s;
 assert.equal(current.revision,saved.revision);assert.equal(current.canvas.data.goal,'SAVED VERSION');
});
