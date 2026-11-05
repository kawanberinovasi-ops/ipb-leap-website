import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {as,createDB,id} from './fixtures/database.mjs';

const sql=await readFile(new URL('../backend/erp/integrations/profile-details.sql',import.meta.url),'utf8');
const read=async db=>(await db.query('select public.erp_profile_details() result')).rows[0].result;
const patch=async (db,details)=>(await db.query('select public.erp_profile_details($1::jsonb) result',[JSON.stringify(details)])).rows[0].result;

test('additional profile fields persist for their owner without exposing identity or other profiles',async()=>{
 const db=await createDB();
 try{
  await db.exec(sql);
  await as(db,'mentor');
  assert.deepEqual(await read(db),{});
  const details={nick:'Nama Uji',city:'Bekasi',bio:'Bio uji.',linkedin:'https://www.linkedin.com/in/contoh/',interests:[' Riset ','Mentoring']};
  await patch(db,details);
  await as(db,'mentee');
  assert.deepEqual(await read(db),{});
  await patch(db,{city:'Bogor'});
  await assert.rejects(db.query('select * from erp_private.profile_details'),/permission denied/);
  await as(db,'mentor');
  assert.deepEqual(await read(db),{...details,interests:['Riset','Mentoring']});
  assert.deepEqual(await patch(db,{bio:'',interests:[]}),{...details,bio:'',interests:[]});
  for(const invalid of [{user_id:id(1)},{roles:['system']},{email:'other@example.test'},{city:null},{linkedin:'https://linkedin.com.example.test/in/other'},{interests:[5]}]){
   await assert.rejects(patch(db,invalid),/profil|LinkedIn|minat/i);
  }
  await as(db,'mentee','anon');
  await assert.rejects(read(db),/permission denied/);
  await db.exec('reset role');
  await db.query('update erp_profiles set active=false where id=$1',[id(3)]);
  await as(db,'mentor');
  await assert.rejects(read(db),/akun aktif/);
 }finally{await db.close();}
});
