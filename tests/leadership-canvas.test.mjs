import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {as,createDB,id} from './fixtures/database.mjs';
import {blocks} from '../src/assets/dmc/blocks.mjs';

test('Leadership Model Canvas separates drafts from shared versions and enforces assignment and revision',async()=>{
 const db=await createDB();
 try{
  await db.exec(await readFile('backend/erp/integrations/group-live-data.sql','utf8'));
  const files=await readdir('supabase/migrations');
  for(const suffix of ['_grow_canvas_authenticated.sql','_leadership_model_canvas.sql'])
   await db.exec(await readFile('supabase/migrations/'+files.find(file=>file.endsWith(suffix)),'utf8'));
  const subject=[id(20),id(1)];
  const get=async role=>(await db.query('select erp_dmc_state($1,$2,$3) as canvas',[...subject,role])).rows[0].canvas;
  const save=async (audience,share,revision)=>{
   const input=Object.fromEntries(blocks.map(({id})=>[id,id==='audience'?audience:'']));
   return (await db.query('select erp_dmc_save($1,$2,$3,$4,$5) as canvas',[...subject,input,share,revision])).rows[0].canvas;
  };
  await as(db,'mentee');
  assert.deepEqual(await get('mentee'),{draft:null,shared:null,revision:0});
  await assert.rejects(save(' \t ',true,0),/minimal satu/);
  assert.equal((await save('Privat',false,0)).draft.audience,'Privat');
  await assert.rejects(save('Stale',false,0),/berubah di tab lain/);
  await as(db,'asmen');
  assert.deepEqual(await get('asmen'),{shared:null});
  await assert.rejects(save('Tidak boleh',true,1),/sesuai penugasan/);
  await assert.rejects(db.query('select * from erp_private.leadership_canvases'),/permission denied/);
  await as(db,'mentee');
  assert.equal((await save('Dibagikan',true,1)).revision,2);
  assert.equal((await save('Draft revisi',false,2)).revision,3);
  for(const role of ['asmen','mentor']){
   await as(db,role);
   const canvas=await get(role);
   assert.deepEqual(Object.keys(canvas),['shared']);
   assert.equal(canvas.shared.audience,'Dibagikan');
  }
  await as(db,'stranger');
  await assert.rejects(get('mentor'),/sesuai penugasan/);
  await as(db,'mentee','anon');
  await assert.rejects(get('mentee'),/permission denied/);
 }finally{await db.close();}
});
