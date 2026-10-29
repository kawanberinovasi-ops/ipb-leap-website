import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID}from'node:crypto';
import {createDB,as,id,actors} from './fixtures/database.mjs';import {buildOperation,latest} from '../backend/erp/functions/domain.mjs';
test('assessment: draft → submit → repair → resubmit → evidence → publication, persisted versions and role enforcement',async t=>{
 const db=await createDB();t.after(()=>db.close());await db.exec('grant usage on schema erp_private to service_role');
 const load=async name=>{await as(db,name);return(await db.query('select erp_workspace($1,$2) as w',[id(20),id(1)])).rows[0].w;};
 const rev=async name=>{await as(db,name);return(await db.query('select erp_revision($1,$2) as r',[id(20),id(1)])).rows[0].r;};
 async function send(name,p,expected){const w=await load(name);const revision=expected??await rev(name);const operation=buildOperation(w,p);
 const trusted={actor:id(actors[name]),session:id(actors[name]+100),cohort:id(20),mentee:id(1),revision,cohortRevision:0,action:p.action,operations:[operation],request:randomUUID(),hash:'TEST ONLY'};
 await as(db,name,'service_role');return(await db.query('select erp_commit_records($1::jsonb) as r',[JSON.stringify(trusted)])).rows[0].r;}
 const abcId=id(200),abc={activity:'Mentoring/check-in',activityDate:'2025-01-01',awareness:'Saya perlu fokus.',bestStep:'Saya memilih satu tindakan.',action:'Melakukan langkah konkret.',deadline:'2025-02-01',evidencePlan:'Catatan hasil',support:'Tidak ada'};
 await send('mentee',{id:abcId,kind:'abc',month:1,action:'save',data:{awareness:'Draft'}});
 await send('mentee',{id:abcId,kind:'abc',month:1,action:'submit',data:abc});
 await send('asmen',{id:abcId,month:1,action:'abc_check',data:{note:'Perjelas tindakannya',repair:true}});
 let w=await load('mentee');assert.equal(latest(w.records.find(r=>r.id===abcId)).status,'Perlu perbaikan');assert.deepEqual(latest(w.records.find(r=>r.id===abcId)).data,abc);
 await send('mentee',{id:abcId,month:1,action:'submit',data:{...abc,action:'Melakukan satu uji lapangan.'}});
 await send('asmen',{id:abcId,month:1,action:'abc_check',data:{note:'Lengkap',repair:false}});
 await send('asmen',{id:abcId,month:1,action:'commitment',data:{status:'Selesai',action:'Uji lapangan',result:'Catatan tersedia',learning:'Belajar',next:'Uji berikutnya',note:'Diperiksa'}});
 const before=await rev('mentee');await send('mentee',{id:abcId,month:1,action:'save',data:abc});
 await assert.rejects(send('mentee',{id:abcId,month:1,action:'save',data:abc},before),/berubah/);
 const pocId=id(201),kpi={id:id(202),title:'Hasil uji',kind:'number',baseline:0,unit:'unit',direction:'up',measurement:'Data hasil',evidencePlan:'Dokumen',levels:Object.fromEntries([3,6,9,12].map(m=>['M'+m,{progress:2,achieve:4,exceed:6}]))};
 const poc={title:'POC test',outcome:'Outcome',baselineContext:'Awal',risk:'Risiko',support:'Tidak ada',plan:'Rencana',kpis:[kpi]};
 await send('mentee',{id:pocId,kind:'poc',month:1,action:'submit',data:poc});
 await assert.rejects(send('asmen',{id:pocId,month:1,action:'poc_decide',data:{note:'Saya setujui'}}),/tugas Mentor/);
 await send('mentor',{id:pocId,month:1,action:'poc_decide',data:{note:'Disepakati'}});
 await db.exec('reset role');
 for(let i=0;i<4;i++)await db.query("insert into erp_sessions(id,cohort_id,group_id,kind,starts_at,month_no,participant_ids,created_by)values($1,$2,$3,'checkin',$4,$5,$6,$7)",[id(210+i),id(20),id(21),`2025-0${2+Math.floor(i/2)}-${i%2?20:'05'}T09:00:00+07:00`,2+Math.floor(i/2),[id(1)],id(9)]);
 for(let i=0;i<4;i++){
 await send('mentee',{id:id(220+i),kind:'checkin',session:id(210+i),month:2+Math.floor(i/2),action:'submit',data:{action:'Dijalankan',result:'Hasil',proofText:'Bukti diperiksa',learning:'Belajar',next:'Lanjut',deadline:'2025-05-01'}});
 await send('asmen',{id:id(220+i),month:2+Math.floor(i/2),action:'process',data:{color:'Green',note:'Tindakan dan bukti diperiksa',actionChecked:true,evidenceChecked:true}});
 }
 w=await load('mentee');const pocVersion=latest(w.records.find(r=>r.id===pocId)).id;
 const actualId=id(230),actual={pocVersion,items:[{kpiId:kpi.id,value:4,summary:'Empat unit',proofText:'Bukti hasil'}],learning:'Belajar',next:'Lanjut'};
 await send('mentee',{id:actualId,kind:'actual',month:3,action:'submit',data:actual});
 await send('asmen',{id:actualId,month:3,action:'evidence',data:{items:[{kpiId:kpi.id,tier:3,verified:true,note:'Outcome terverifikasi'}]}});
 w=await load('mentor');const ar=w.records.find(r=>r.id===actualId),review={pocVersion,actualVersion:latest(ar).id,evidenceCheck:ar.checks.at(-1).id,items:[{kpiId:kpi.id,level:'Achieve',confirmed:true,reason:'Sesuai patokan'}],next:'Pertahankan hasil'};
 await assert.rejects(send('asmen',{id:id(240),kind:'review',month:3,action:'publish',data:review}),/Penilai periode/);
 await send('mentor',{id:id(240),kind:'review',month:3,action:'review_save',data:review});
 await send('mentor',{id:id(240),kind:'review',month:3,action:'publish',data:review});
 w=await load('mentee');const rr=w.records.find(r=>r.id===id(240));assert.equal(rr.publications.length,1);assert.equal(rr.publications[0].score.total,83.33);assert.equal(rr.publications[0].score.components.p3,null);assert.equal(rr.versions.length,1); // Unpublished assessor draft is not readable by mentee.
 for(const name of ['finance','system']){const restricted=await load(name);assert.equal(restricted.selectedMentee,null);assert.equal(restricted.records.length,0);}
 await as(db,'stranger');await assert.rejects(db.query('select erp_revision($1,$2)',[id(20),id(1)]),/diakses/);
 await send('mentee',{id:actualId,month:3,action:'submit',data:{...actual,items:[{...actual.items[0],value:6}]}});
 await assert.rejects(send('mentor',{id:id(240),month:3,action:'publish',data:review}),/belum memeriksa/);
 w=await load('mentee');assert.equal(w.records.find(r=>r.id===id(240)).publications[0].score.total,83.33);assert.ok(w.records.find(r=>r.id===abcId).versions.length>=6);
 await as(db,'mentee');await assert.rejects(db.query('select erp_commit_records($1::jsonb)',['{}']),/permission denied/);
});
