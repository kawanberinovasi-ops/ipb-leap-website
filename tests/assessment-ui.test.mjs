import {test}from'node:test';import assert from'node:assert/strict';import vm from'node:vm';import{readFile}from'node:fs/promises';import{JSDOM}from'jsdom';import * as domain from'../src/assets/assessment/domain.mjs';import * as sources from'../src/assets/assessment/sources.mjs';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const tick=async()=>{for(let n=0;n<8;n++)await new Promise(setImmediate);};
function state(role='mentee'){return{actor:{id:id(1),display_name:'TEST ONLY',roles:[role],active:true},selectedCohort:id(2),selectedMentee:id(1),cohorts:[{id:id(2),name:'TEST',starts_on:'2026-01-01'}],profiles:[{id:id(1),display_name:'TEST ONLY'}],records:[],sessions:[],groups:[],members:[],enrolments:[{user_id:id(1),role:'mentee',active:true}],staff:[]};}
async function ui(w,path='abc',options={}){
 const dom=new JSDOM('<section id="assessment"><main id="content"></main><dialog id="activation-dialog"></dialog><input id="activation-link"><p id="activation-details"></p><button id="copy-activation"></button><button id="close-activation"></button><dialog id="copy-dialog"></dialog><textarea id="copy-text"></textarea><button id="close-copy"></button></section>',{url:'https://example.test/subpath/app/'+path+'.html?cohort='+id(2)+'&mentee='+id(1)+'&period=6',runScripts:'outside-only'});
 const context=dom.getInternalVMContext(),document=dom.window.document;
 dom.window.matchMedia=()=>({matches:true});dom.window.HTMLElement.prototype.scrollIntoView=()=>{};dom.window.confirm=()=>true;
 let count=0;
 const api={configured:true,client:{auth:{signOut:async()=>{}}},verifiedUser:async()=>({id:id(1)}),workspace:async()=>structuredClone(w),bootstrap:async()=>{},revision:async()=>count,command:async()=>{},accountCommand:async()=>{},errorText:e=>e.message,recordCommand:async p=>{options.onCommand?.(p);if(options.error)throw Error(options.error);const op=domain.buildOperation(w,p);let r=w.records.find(r=>r.id===p.id);if(!r){r={id:p.id,kind:p.kind,month_no:p.month,mentee_id:id(1),versions:[],checks:[],publications:[]};w.records.push(r);}r.versions.push({id:id(100+count),number:r.versions.length+1,status:op.status,data:op.data,created_at:'2026-10-01T00:00:00Z'});r.latest_status=op.status;count++;return{ok:true};}};
 const dependencies={'sources.mjs':sources,'api.mjs':api,'domain.mjs':domain,'observer.mjs':{observerWorkspace:async()=>({available:false,feedback:[],reason:'Belum diaktifkan'}),observerPanel:()=>'',observerSelection:()=>''}};
 const module=new vm.SourceTextModule(await readFile(new URL('../src/assets/assessment/app.mjs',import.meta.url),'utf8'),{context,identifier:'https://example.test/subpath/assets/assessment/app.mjs',initializeImportMeta:m=>m.url='https://example.test/subpath/assets/assessment/app.mjs'});
 await module.link(specifier=>{const name=specifier.split('/').pop().split('?')[0],data=dependencies[name];return new vm.SyntheticModule(Object.keys(data),function(){for(const[k,v]of Object.entries(data))this.setExport(k,v);},{context});});
 await module.evaluate();module.namespace.mount();await tick();return{dom,document,click:async selector=>{document.querySelector(selector).click();await tick();}};
}
test('UI: ABC without POC saves, reloads and carries cohort/mentee/period',async()=>{
 const w=state();let payload;const view=await ui(w,'abc',{onCommand:p=>payload=p});assert.match(view.document.body.textContent,/Belum ada catatan/);
 await view.click('[data-new="abc"]');assert.ok(view.document.querySelector('#record-form'));const f=view.document.querySelector('#record-form');f.elements.awareness.value='Draft tidak membutuhkan POC';
 await view.click('[data-record-action="save"]');assert.equal(payload.kind,'abc');assert.equal(payload.data.awareness,'Draft tidak membutuhkan POC');assert.equal(w.records.length,1);
 const next=await ui(w);assert.match(next.document.querySelector('#abc-list').textContent,/Draft/);const link=next.document.querySelector('.subject-tabs a');assert.match(link.href,/cohort=/);assert.match(link.href,/mentee=/);assert.match(link.href,/period=6/);assert.ok(link.href.includes('/subpath/app/poc.html'));view.dom.window.close();next.dom.window.close();
});
test('UI: save conflict retains exact input and retry request ID',async()=>{
 const requests=[];const view=await ui(state(),'abc',{error:'Data berubah. Muat ulang sebelum menyimpan.',onCommand:p=>requests.push(p)});await view.click('[data-new="abc"]');const field=view.document.querySelector('[name=awareness]');field.value='Jangan hilangkan isian saya';await view.click('[data-record-action="save"]');assert.equal(field.value,'Jangan hilangkan isian saya');assert.match(view.document.querySelector('#message').textContent,/Data berubah/);await view.click('[data-record-action="save"]');assert.equal(requests[0].id,requests[1].id);assert.equal(requests[0].request,requests[1].request);view.dom.window.close();
});
test('UI: finance and system cannot access assessment forms with no subject grants',async()=>{
 for(const role of ['finance','system']){const w=state(role);w.selectedMentee=null;w.enrolments=[];const v=await ui(w,'penilaian');assert.match(v.document.body.textContent,/Belum ada mentee/);assert.equal(v.document.querySelectorAll('form').length,0);v.dom.window.close();}
});
