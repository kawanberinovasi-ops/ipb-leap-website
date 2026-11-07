import * as phases from '../src/assets/grow/phases.mjs';
import * as bulkImport from '../src/assets/management/import.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import * as management from '../src/assets/management/store.mjs';
import {createLocalStore,STORAGE_KEY,MANAGER,participantProgress,TRACKS} from '../src/assets/management/store.mjs';

const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
function setup(){let value=null,n=1,fail=false;const storage={getItem:()=>value,setItem:(k,v)=>{if(fail)throw Error('Quota');value=v;}};return{storage,store:createLocalStore(storage,{uuid:()=>id(n++),now:()=> '2026-11-02T07:00:00Z'}),fail:()=>fail=true};}
function cohort(store){return store.cohort({name:'TEST ONLY',starts_on:'2026-01-01',ends_on:'2026-12-31'},store.read().revision);}
function mentee(store,c,name='TEST ONLY',extra={}){return store.account({display_name:name,email:name.replaceAll(' ','').toLowerCase()+'@example.test',role:'mentee',cohort_id:c.id,field:TRACKS[0].field,pathway:'Grow',active:true,...extra},store.read().revision);}

test('local management starts empty; account metadata persists without login, credentials or sample progress',()=>{
 const {store,storage}=setup();assert.equal(store.read().profiles.length,0);assert.equal(store.read().records.length,0);const c=cohort(store),user=mentee(store,c);const reloaded=createLocalStore(storage);assert.equal(reloaded.read().profiles[0].id,user);assert.equal(reloaded.read().profiles[0].local_only,true);assert.equal(reloaded.read().profiles[0].email,'testonly@example.test');assert.equal(reloaded.read().profiles[0].password,undefined);assert.equal(participantProgress(reloaded.read(),user,c.id).publication,null);assert.equal(reloaded.read().records.length,0);
});
test('local management validates email, track/pathway, group membership and stale writes while preserving previous data',()=>{
 const {store}=setup(),c=cohort(store);assert.throws(()=>mentee(store,c,'Bad',{pathway:'Produce'}),/track dan pathway/);assert.equal(store.read().profiles.length,0);const user=mentee(store,c);assert.throws(()=>mentee(store,c),/Email/);const revision=store.read().revision;mentee(store,c,'SECOND TEST');assert.throws(()=>store.account({id:user,display_name:'Changed',email:'changed@example.test',role:'mentee',cohort_id:c.id,field:TRACKS[0].field,pathway:'Grow'},revision),/Data berubah/);assert.equal(store.read().profiles.find(p=>p.id===user).display_name,'TEST ONLY');
});
test('Mentoring draft appears in own cohort progress after reload; manager sees metadata without private answer access',()=>{
 const {store,storage}=setup(),c=cohort(store),user=mentee(store,c),actor=store.read().profiles.find(p=>p.id===user);const payload={request:id(500),id:id(501),action:'save',kind:'mentoring',cohort:c.id,mentee:user,month:11,expected:store.read().revision,data:{insight:'PRIVATE TEST CONTENT',sessionDetails:{kind:'Common Class',date:'2026-11-01',time:'09:00'}}};
 store.recordCommand(payload,actor);store.recordCommand(payload,actor);const s=createLocalStore(storage).read(),p=participantProgress(s,user,c.id);assert.equal(p.mentoring,1);assert.equal(p.submittedMentoring,0);assert.equal(p.publication,null);assert.equal(p.records[0].versions.length,1);assert.equal(store.workspace(c.id,user,MANAGER).records.length,0);assert.equal(store.workspace(c.id,user,actor).records.length,1);
 const other=mentee(store,c,'OTHER TEST'),otherActor=store.read().profiles.find(p=>p.id===other);assert.equal(store.workspace(c.id,user,otherActor).records.length,0);assert.throws(()=>store.recordCommand({...payload,request:id(600),id:id(601),expected:store.read().revision},otherActor),/tidak dapat diakses/);
});
test('local write failure or corrupt storage never resets existing data or reports successful persistence',()=>{
 const fixture=setup(),c=cohort(fixture.store),before=fixture.storage.getItem(STORAGE_KEY);fixture.fail();assert.throws(()=>mentee(fixture.store,c),/belum tersimpan/);assert.equal(fixture.storage.getItem(STORAGE_KEY),before);const broken={getItem:()=>'{broken',setItem:()=>{throw Error('Must not overwrite');}};assert.throws(()=>createLocalStore(broken).read(),/tidak dapat dibaca/);
});
test('local group assignment enforces track and five mentees, while group editing retains identity',()=>{
 const {store}=setup(),c=cohort(store);const g=store.group({name:'TEST GROUP',cohort_id:c.id,field:TRACKS[0].field},store.read().revision);
 for(let i=0;i<5;i++)mentee(store,c,'GROUP TEST '+i,{group_id:g.id});
 assert.throws(()=>mentee(store,c,'SIXTH TEST',{group_id:g.id}),/lima mentee/);
 assert.throws(()=>mentee(store,c,'WRONG TRACK',{group_id:g.id,field:TRACKS[1].field,pathway:'Produce'}),/track mentee/);
 store.group({...g,name:'RENAMED TEST GROUP'},store.read().revision);assert.equal(store.read().groups.length,1);assert.equal(store.read().groups[0].id,g.id);
 assert.throws(()=>store.group({...g,field:TRACKS[1].field},store.read().revision),/dipertahankan/);
});

async function ui(fixture,actor=MANAGER,path=''){
 const dom=new JSDOM('<!doctype html><html data-leap-local="true"><body><main id="management"></main></body></html>',{url:'http://example.test/app/kelola-program.html'+path,runScripts:'outside-only'});
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new dom.window.Event('close'));};
 const context=dom.getInternalVMContext(),m=new vm.SourceTextModule(await readFile(new URL('../src/assets/management/app.mjs',import.meta.url),'utf8'),{context});
 const deps={downloadGrowPdf:async()=>{},...phases,...bulkImport,...management,localStore:()=>fixture.store,localActor:()=>actor};await m.link(spec=>{const values=spec.includes('repository.mjs')?{openRepository:async()=>({store:fixture.store,actor,local:true})}:spec.includes('/attendance/')?{attendanceState:async()=>({events:[],participants:[],attendance:[],history:[]}),menteeAttendance:()=>[]}:deps;return new vm.SyntheticModule(Object.keys(values),function(){for(const[k,v]of Object.entries(values))this.setExport(k,v);},{context});});await m.evaluate();await m.namespace.mount();return{dom,document:dom.window.document};
}
test('management form creates and edits an account; duplicate email preserves exact input and reload shows saved metadata',async()=>{
 const fixture=setup(),c=cohort(fixture.store),v=await ui(fixture),d=v.document;
 d.querySelector('[data-action="account"]').click();let f=d.querySelector('#mg-dialog form');for(const[k,value]of Object.entries({display_name:'UI TEST',email:'ui@example.test'}))f.elements[k].value=value;
 f.elements.field.value=TRACKS[0].field;f.elements.field.dispatchEvent(new v.dom.window.Event('change'));f.elements.pathway.value='Grow';f.dispatchEvent(new v.dom.window.Event('submit',{cancelable:true}));await new Promise(r=>setImmediate(r));
 assert.equal(fixture.store.read().profiles.length,1);const id=fixture.store.read().profiles[0].id;assert.match(d.querySelector('#mg-results').textContent,/UI TEST/);
 d.querySelector('[data-action="edit:'+id+'"]').click();f=d.querySelector('#mg-dialog form');f.elements.display_name.value='EDITED TEST';f.dispatchEvent(new v.dom.window.Event('submit',{cancelable:true}));await new Promise(r=>setImmediate(r));assert.equal(fixture.store.read().profiles[0].id,id);assert.equal(fixture.store.read().profiles[0].display_name,'EDITED TEST');
 d.querySelector('[data-action="account"]').click();f=d.querySelector('#mg-dialog form');f.elements.display_name.value='KEEP THIS INPUT';f.elements.email.value='ui@example.test';f.elements.field.value=TRACKS[0].field;f.elements.field.dispatchEvent(new v.dom.window.Event('change'));f.elements.pathway.value='Grow';f.dispatchEvent(new v.dom.window.Event('submit',{cancelable:true}));await new Promise(r=>setImmediate(r));assert.match(f.querySelector('.mg-error').textContent,/Email/);assert.equal(f.elements.display_name.value,'KEEP THIS INPUT');assert.equal(d.querySelector('#mg-dialog').open,true);
 const reload=await ui(fixture);assert.match(reload.document.querySelector('#mg-results').textContent,/EDITED TEST/);v.dom.window.close();reload.dom.window.close();
});
test('individual progress shows persisted metadata while private Mentoring text stays out of management HTML',async()=>{
 const fixture=setup(),c=cohort(fixture.store),idUser=mentee(fixture.store,c),actor=fixture.store.read().profiles[0];
 fixture.store.recordCommand({request:id(500),id:id(501),action:'save',kind:'mentoring',cohort:c.id,mentee:idUser,month:11,expected:fixture.store.read().revision,data:{insight:'PRIVATE MUST STAY HIDDEN'}},actor);
 const v=await ui(fixture,MANAGER,'?cohort='+c.id+'&mentee='+idUser);assert.match(v.document.body.textContent,/1 catatan/);assert.match(v.document.body.textContent,/Draft/);assert.ok(!v.document.body.textContent.includes('PRIVATE MUST STAY HIDDEN'));assert.equal(fixture.store.workspace(c.id,idUser,MANAGER).receipts,undefined);v.dom.window.close();
 const finance=await ui(fixture,{...MANAGER,id:id(99),roles:['finance']});assert.match(finance.document.body.textContent,/tidak tersedia/);assert.equal(finance.document.querySelectorAll('form').length,0);finance.dom.window.close();
});
test('local build isolates production connections and normal page cannot silently use local account creation',async()=>{
 const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');const [app,api,build]=await Promise.all([read('src/assets/management/app.mjs'),read('src/assets/management/local-api.mjs'),read('tools/build_local_management.py')]);assert.ok(app.includes('openRepository'));const repository=await read('src/assets/management/repository.mjs');assert.ok(repository.includes("if(isLocal()){"));assert.ok(repository.includes("erp_management_workspace"));assert.ok(!api.includes('fetch('));assert.ok(!api.includes('createClient('));assert.ok(api.includes('Aktivasi akun produksi tidak dijalankan'));assert.ok(build.includes("assets / 'assessment/api.mjs'"));assert.ok(build.includes("OUT = ROOT / '.local-management'"));
});
