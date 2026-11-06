import * as bulkImport from '../src/assets/management/import.mjs';
import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';import {JSDOM} from 'jsdom';import * as metadata from '../src/assets/management/store.mjs';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const tick=()=>new Promise(r=>setImmediate(r));
test('production management creates shared-auth activation, has no local rehearsal, and retains input on server conflicts',async()=>{
 const dom=new JSDOM('<html><body><main id="management"></main></body></html>',{url:'https://example.test/app/kelola-program.html',runScripts:'outside-only'});const d=dom.window.document;
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const actor={id:id(9),roles:['program'],active:true};const state={revision:0,cohorts:[{id:id(20),name:'TEST',starts_on:'2026-01-01',ends_on:'2026-12-31'}],profiles:[],enrolments:[],groups:[],members:[],records:[],staff:[{user_id:actor.id,can_manage:true}],audit:[]};let saved,groupSaved,archived,conflict=false;
 const store={read:()=>state,reload:async()=>state,
 group:async data=>{groupSaved=data;state.groups.push({...data,id:id(70)});},
 archiveGroup:async (id,cohort)=>{archived={id,cohort};state.groups[0].archived_at='2026-11-07';},
 account:async data=>{if(conflict)throw Error('Data berubah. Muat ulang.');saved=data;state.profiles.push({id:id(30),display_name:data.display_name,email:data.email,roles:['mentee'],active:false});state.enrolments.push({user_id:id(30),cohort_id:id(20),role:'mentee',field:data.field,pathway:data.pathway,active:true});return data.initial_password?{mustChangePassword:true}:{url:'https://example.test/app/index.html#activate=TEST_ONLY'};}};
 const values={...bulkImport,...metadata,openRepository:async()=>({store,actor,local:false}),attendanceState:async()=>({events:[],participants:[],attendance:[],history:[]}),menteeAttendance:()=>[]};
 const context=dom.getInternalVMContext();const m=new vm.SourceTextModule(await readFile(new URL('../src/assets/management/app.mjs',import.meta.url),'utf8'),{context});await m.link(()=>new vm.SyntheticModule(Object.keys(values),function(){for(const[k,v]of Object.entries(values))this.setExport(k,v);},{context}));await m.evaluate();await m.namespace.mount();
 assert.match(d.body.textContent,/Terhubung ke Supabase/);assert.ok(!d.body.textContent.includes('Coba alur peserta'));assert.equal(d.querySelector('[data-action=cohort]'),null);
 for(const [n,pending,enrolled]of[[40,true,true],[41,false,true],[42,true,false]]){state.profiles.push({id:id(n),display_name:'TEST STAFF '+n,email:n+'@example.test',roles:['asmen'],active:false,pending_activation:pending});state.enrolments.push({user_id:id(n),cohort_id:id(20),role:'asmen',active:enrolled});}
 for(const [n,track] of [[51,0],[52,1]]){
  state.profiles.push({id:id(n),display_name:'TEST MENTEE '+n,email:n+'@example.test',roles:['mentee'],active:false,pending_activation:true});
  state.enrolments.push({user_id:id(n),cohort_id:id(20),role:'mentee',active:true,field:metadata.TRACKS[track].field});
 }
 d.querySelector('[data-tab=groups]').click();d.querySelector('[data-action=group]').click();const groupForm=d.querySelector('form');assert.deepEqual([...groupForm.elements.asmen_id.options].map(o=>o.value),['',id(40)]);assert.match(groupForm.elements.asmen_id.options[1].textContent,/belum aktivasi/);assert.match(groupForm.textContent,/Peserta yang menunggu aktivasi dapat dipilih/);groupForm.elements.name.value='TEST CREATED';
 groupForm.elements.field.value=metadata.TRACKS[0].field;
 groupForm.elements.field.dispatchEvent(new dom.window.Event('change'));
 const choices=[...groupForm.querySelectorAll('[name=mentee_ids]')];
 assert.deepEqual(choices.map(c=>c.value),[id(51)]);
 choices[0].checked=true;
 groupForm.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await tick();
 assert.deepEqual(Array.from(groupSaved.mentee_ids),[id(51)]);
 d.querySelector('[data-action^=archivegroup]').click();
 assert.match(d.querySelector('dialog').textContent,/riwayat tetap tersimpan/);
 d.querySelector('#mg-dialog form').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await tick();
 assert.deepEqual(archived,{id:id(70),cohort:id(20)});
 assert.equal(d.querySelector('[data-action^=archivegroup]'),null);
 d.querySelector('[data-tab=accounts]').click();
 d.querySelector('[data-action=account]').click();let f=d.querySelector('form');assert.deepEqual([...f.elements.role.options].map(o=>o.value),['','mentee','asmen','mentor']);
 assert.equal(f.elements.pathway.required,false);
 const fill=()=>{f.elements.display_name.value='TEST NEW';f.elements.email.value='test@example.test';f.elements.field.value=metadata.TRACKS[0].field;f.elements.field.dispatchEvent(new dom.window.Event('change'));f.elements.pathway.value='';};fill();f.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await tick();
 assert.equal(saved.cohort_id,id(20));assert.match(d.querySelector('input[name=activation]').value,/#activate=TEST_ONLY/);assert.match(d.querySelector('dialog').textContent,/Belum ada email/);d.querySelector('[data-action=close]').click();
 d.querySelector('[data-action=account]').click();f=d.querySelector('form');fill();conflict=true;f.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await tick();assert.match(f.querySelector('.mg-error').textContent,/Data berubah/);assert.equal(f.elements.display_name.value,'TEST NEW');assert.equal(d.querySelector('dialog').open,true);
 d.querySelector('[data-action=close]').click();conflict=false;d.querySelector('[data-action=import]').click();const file=d.querySelector('#mg-roster');Object.defineProperty(file,'files',{value:[{size:100,text:async()=>JSON.stringify([{display_name:'TEST ASMEN',email:'asmen@example.test',role:'asmen',field:metadata.TRACKS[0].field}])}]});await file.onchange();assert.match(d.querySelector('#mg-import-preview').textContent,/1 akun baru/);d.querySelector('#mg-initial-password').value='TEST ONLY not a real credential';d.querySelector('#mg-initial-confirm').value='TEST ONLY not a real credential';await d.querySelector('#mg-import-start').onclick();assert.equal(saved.pathway,'');assert.equal(saved.group_id,'');assert.match(d.querySelector('#mg-import-status').textContent,/Selesai: 1 akun dibuat/);assert.equal(d.querySelector('#mg-import-download').hidden,false);d.querySelector('#mg-import-close').click();assert.match(d.querySelector('.mg-error').textContent,/Unduh/);dom.window.close();
});
