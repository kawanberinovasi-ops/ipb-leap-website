import * as roster from '../src/assets/grow/roster.mjs';
import * as phases from '../src/assets/grow/phases.mjs';
import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';import {JSDOM} from 'jsdom';
const read=p=>readFile(new URL('../src/assets/grow/'+p,import.meta.url),'utf8');
const catalog=JSON.parse(await read('catalog.json')),track=catalog.find(t=>t.id==='social');
async function module(code,context,deps,url='https://example.test/assets/grow/app.mjs'){const m=new vm.SourceTextModule(code,{context,identifier:url,initializeImportMeta:x=>x.url=url});await m.link(spec=>{const values=deps[spec.split('?')[0].split('/').at(-1)];if(!values)throw Error('Unexpected import '+spec);return new vm.SyntheticModule(Object.keys(values),function(){for(const[k,v]of Object.entries(values))this.setExport(k,v);},{context});});await m.evaluate();return m.namespace;}
const scores={3:{asmen:25,mentor:52.5,total:77.5,checked:1,eligible:1,waiting:0},6:{asmen:null,mentor:null,total:null,checked:0,eligible:0,waiting:0},9:{asmen:null,mentor:null,total:null,checked:0,eligible:0,waiting:0},12:{asmen:null,mentor:null,total:null,checked:0,eligible:0,waiting:0}};
function state(){return{today:'2026-11-04',revision:5,canvas:{status:'Disepakati',version:1,data:{goal:'TEST GOAL',why:'TEST WHY',reality:'TEST REALITY',options:'TEST OPTIONS',wayForward:'TEST WAY',mentorNeed:'Tidak ada',kpis:[{id:'socialBeneficiaries',baseline:'0',measurement:'VERIFIED RECORDS',milestones:{3:'100',6:'250',9:'375',12:'500'}}]}},canvasHistory:[],supportReplies:{},sessions:[],notes:[{id:'NOTE',period:3,status:'Diajukan',data:{date:'2026-11-02',due:'2026-11-04',learning:'TEST LEARNING',action:'TEST ACTION'},outcome:{status:'Selesai',result:'TEST RESULT',completed:'2026-11-04'},outcomeRevision:1}],reviews:{},scores:structuredClone(scores),publications:[{period:3,canvasVersion:1,canvas:{data:{kpis:[{id:'socialBeneficiaries',milestones:{3:'100'}}]}},review:{items:[{id:'socialBeneficiaries',actual:'75',level:75,reason:'75 of 100'}]},score:{asmen:25,mentor:52.5,total:77.5},at:'2026-11-04T10:00:00+07:00'}]};}
async function ui(role,view='report',initial=state()){
 const dom=new JSDOM('<main id="grow-app" data-view="'+view+'"></main>',{url:'https://example.test/app/raport.html?role=system&demo=assessment&period=3',runScripts:'outside-only'}),context=dom.getInternalVMContext();dom.window.Element.prototype.scrollIntoView=()=>{};dom.window.structuredClone=structuredClone;let sent=[],failure=false;
 const deps={'roster.mjs':roster,'phases.mjs':phases,'context.mjs':{boot:async()=>true,href:(file,extra={})=>file+'?'+new URLSearchParams({cohort:'C',mentee:'M',...extra}),role,track:'social',currentTrack:track,scope:{cohort:{starts_on:'2026-11-01'},people:[{id:'M',name:'ACTUAL ASSIGNED NAME'}],mentee:'M'},loadWorkspace:async()=>structuredClone(initial),sendCommand:async(action,data,expected)=>{sent.push({action,data,expected});if(failure)throw Error('TEST CONFLICT');return structuredClone(initial);}}};
 const app=await module(await read('app.mjs'),context,deps);await app.mount();return{dom,d:dom.window.document,sent,fail:()=>failure=true};
}
test('production GROW renders no preview controls, duplicate navigation or fake role from query',async()=>{
 const v=await ui('mentee');assert.equal(v.d.querySelector('nav.tabs'),null);assert.deepEqual([...v.d.querySelectorAll('[aria-label="Periode raport"] a')].map(a=>a.firstChild.textContent),['Foundation','Action','Acceleration','Sustainable Impact']);assert.deepEqual([...v.d.querySelectorAll('.phase-button small')].map(el=>el.textContent),['November 2026–Januari 2027','Februari–April 2027','Mei–Juli 2027','Agustus–Oktober 2027']);assert.equal(v.d.querySelector('#local-preview-controls'),null);assert.equal(v.d.querySelector('.practice-guide'),null);assert.equal(v.d.querySelector('#review-form button'),null);assert.ok(v.d.querySelector('.outcome-form'));assert.equal(v.d.querySelectorAll('#hasil-terbit .score').length,1);assert.equal(v.d.querySelector('#hasil-terbit .score').textContent,'77,5');assert.ok(!v.d.querySelector('#hasil-terbit').textContent.includes('Mentor /70'));v.dom.window.close();
});
test('Asmen and Mentor get distinct form actions and submitted text remains escaped',async()=>{
 const source=state();source.notes[0].data.action='<img src=x onerror=alert(1)>';
 const a=await ui('asmen','report',source);assert.ok(a.d.querySelector('.check-form'));assert.equal(a.d.querySelector('#review-form button'),null);assert.equal(a.d.querySelector('#tindak-lanjut img'),null);assert.ok(a.d.querySelector('#tindak-lanjut').textContent.includes('<img'));a.dom.window.close();
 const m=await ui('mentor');assert.equal(m.d.querySelector('.check-form'),null);assert.ok(m.d.querySelector('#review-form button'));assert.ok(m.d.querySelector('[data-action=publish]'));m.dom.window.close();
});
test('mentee save submits only the authenticated subject command revision and preserves input on conflict',async()=>{
 const v=await ui('mentee','mentoring'),form=v.d.querySelector('#note-form');v.fail();form.elements.learning.value='KEEP LEARNING';form.elements.action.value='KEEP ACTION';form.elements.due.value='2026-11-05';v.d.querySelector('[data-action=submit-note]').click();for(let i=0;i<5;i++)await new Promise(setImmediate);assert.equal(v.sent[0].action,'note_submit');assert.equal(v.sent[0].expected,5);assert.equal(v.sent[0].data.data.learning,'KEEP LEARNING');assert.equal(v.d.querySelector('[name=learning]').value,'KEEP LEARNING');assert.match(v.d.querySelector('#grow-message').textContent,/CONFLICT/);v.dom.window.close();
});
test('authenticated scope ignores query preview role and rejects another mentee',async()=>{
 async function scope(query){const dom=new JSDOM('',{url:'https://example.test/app/grow-canvas.html?'+query,runScripts:'outside-only'});dom.window.fetch=async()=>({ok:true,json:async()=>catalog});const actor={id:'M',display_name:'AUTHENTICATED NAME',roles:['mentee'],active:true};const base={actor,selectedCohort:'C',cohorts:[{id:'C',name:'REAL BATCH'}],profiles:[actor],enrolments:[{cohort_id:'C',user_id:'M',role:'mentee',active:true,field:track.track}],groups:[],members:[]};const m=await module(await read('context.mjs'),dom.getInternalVMContext(),{'api.mjs':{workspace:async()=>base,rpc:async()=>{}},'session.mjs':{mountSession:async()=>actor}},'https://example.test/assets/grow/context.mjs');return{m,dom};}
 const a=await scope('role=mentor&track=business&demo=assessment');await a.m.boot();assert.equal(a.m.role,'mentee');assert.equal(a.m.track,'social');assert.equal(a.m.scope.mentee,'M');assert.ok(!a.m.href('raport.html').includes('demo'));a.dom.window.close();
 const b=await scope('role=mentor&mentee=FOREIGN');await assert.rejects(b.m.boot(),/tidak ditugaskan/);b.dom.window.close();
});
test('mentee adds multiple track KPIs without losing existing fields and saves every milestone',async()=>{
 const initial=state();initial.canvas.status='Draft';const v=await ui('mentee','canvas',initial),event=()=>new v.dom.window.Event('change',{bubbles:true});
 v.d.querySelector('[name=goal]').value='KEEP MY GOAL';v.d.querySelector('[name="kpi.socialBeneficiaries.baseline"]').value='7';v.d.querySelector('[name="kpi.socialBeneficiaries.m3"]').value='UPDATED FIRST MILESTONE';
 const add=id=>{const s=v.d.querySelector('[name=additionalKpi]');s.value=id;s.dispatchEvent(event());v.d.querySelector('[data-action=add-kpi]').click();};
 add('socialPrograms');assert.equal(v.d.querySelectorAll('[data-canvas-kpi]').length,2);assert.equal(v.d.querySelector('[name=goal]').value,'KEEP MY GOAL');assert.equal(v.d.querySelector('[name="kpi.socialBeneficiaries.baseline"]').value,'7');assert.equal(v.d.querySelector('[name="kpi.socialBeneficiaries.m3"]').value,'UPDATED FIRST MILESTONE');assert.equal(v.d.querySelector('[name="kpi.socialPrograms.m12"]').value,track.kpis.find(k=>k.id==='socialPrograms').label);
 assert.equal(v.d.querySelector('[name=additionalKpi] option[value=socialBeneficiaries]'),null);assert.equal(v.d.querySelector('[name=additionalKpi] option[value=socialPrograms]'),null);
 v.d.querySelector('[name="kpi.socialPrograms.baseline"]').value='1';v.d.querySelector('[name="kpi.socialPrograms.measurement"]').value='VERIFIED PROGRAM REPORTS';for(const p of [3,6,9])v.d.querySelector('[name="kpi.socialPrograms.m'+p+'"]').value='SECOND KPI M'+p;
 add('socialLegal');add('socialFunding');assert.equal(v.d.querySelectorAll('[data-canvas-kpi]').length,4);assert.equal(v.d.querySelector('[data-action=add-kpi]'),null);
 v.d.querySelector('[data-action="remove-kpi:socialLegal"]').click();assert.equal(v.d.querySelectorAll('[data-canvas-kpi]').length,3);assert.ok(v.d.querySelector('[name=additionalKpi] option[value=socialLegal]'));assert.equal(v.d.querySelector('[name="kpi.socialPrograms.m6"]').value,'SECOND KPI M6');
 v.fail();v.d.querySelector('[data-action=save-canvas]').click();for(let i=0;i<5;i++)await new Promise(setImmediate);const sent=v.sent[0];assert.equal(sent.action,'canvas_save');assert.equal(sent.expected,5);assert.equal(sent.data.kpis.length,3);assert.equal(sent.data.goal,'KEEP MY GOAL');assert.equal(sent.data.kpis.find(k=>k.id==='socialBeneficiaries').baseline,'7');assert.equal(sent.data.kpis.find(k=>k.id==='socialPrograms').milestones[6],'SECOND KPI M6');assert.equal(v.d.querySelectorAll('[data-canvas-kpi]').length,3);v.dom.window.close();
});

test('mentoring shows topic and session date without dropping a legacy draft theme on save',async()=>{
 const initial=state();
 initial.notes[0].data.topic='Persiapan proposal';
 initial.notes.push({id:'DRAFT',status:'Draft',period:3,data:{theme:'Legacy',topic:'Diskusi progres'}});
 const v=await ui('mentee','mentoring',initial);
 assert.equal(v.d.querySelector('[name=theme]'),null);
 assert.match(v.d.querySelector('#grow-app').textContent,/Persiapan proposal.*2 November 2026/s);
 v.d.querySelector('[data-action="edit-note:DRAFT"]').click();
 v.d.querySelector('[data-action="save-note"]').click();
 assert.equal(v.sent[0].data.data.theme,'Legacy');
 assert.equal(v.sent[0].data.data.topic,'Diskusi progres');
 v.dom.window.close();
});

test('saving a follow-up confirms beside its form and keeps the form open',async()=>{
 const v=await ui('mentee');
 v.d.querySelector('.outcome-form').dispatchEvent(new v.dom.window.Event('submit',{cancelable:true}));
 await new Promise(setImmediate);
 assert.equal(v.sent[0].action,'outcome_save');
 assert.equal(v.d.querySelector('#outcome-message-NOTE').textContent,'Tindak lanjut berhasil disimpan.');
 assert.equal(v.d.querySelector('.outcome-form').closest('details').open,true);
 v.dom.window.close();
});

test('Mentor sees opening date before publication and can publish on the last day with a complete score',async()=>{
 const early=await ui('mentor');
 assert.equal(early.d.querySelector('[data-action=publish]').disabled,true);
 assert.match(early.d.querySelector('#grow-app').textContent,/mulai 31 Januari 2027/);
 early.dom.window.close();
 const initial=state();
 initial.today='2027-01-31';
 initial.publications[0].score.total=85;
 const ready=await ui('mentor','report',initial);
 assert.equal(ready.d.querySelector('[data-action=publish]').disabled,false);
 assert.match(ready.d.querySelector('#hasil-terbit').textContent,/Kerja bagus/);
 ready.dom.window.close();
 assert.equal(phases.phaseEnd(3,'2026-11-30'),'2027-02-27');
});

test('GROW examples stay out of the draft and feedback appears below the form actions',async()=>{
 const initial=state();
 initial.canvas=null;
 const v=await ui('mentee','canvas',initial);
 const goal=v.d.querySelector('[name=goal]');
 assert.match(goal.placeholder,/^Contoh:/);
 assert.equal(goal.value,'');
 assert.equal(v.d.querySelector('header p.sub'),null);
 v.d.querySelector('[data-action=save-canvas]').click();
 await new Promise(setImmediate);
 assert.equal(v.sent[0].data.goal,'');
 const message=v.d.querySelector('#canvas-form #canvas-message');
 assert.equal(message.previousElementSibling.className,'actions');
 assert.equal(message.textContent,'Draft GROW tersimpan.');
 v.dom.window.close();
});

test('review rosters include only mentees assigned to the signed-in staff account',async()=>{
 for(const role of ['asmen','mentor']){
  const dom=new JSDOM('',{url:'https://example.test/app/grow-canvas.html?period=6',runScripts:'outside-only'});
  dom.window.fetch=async()=>({ok:true,json:async()=>catalog});
  const actor={id:'STAFF',roles:[role]};
  const groupIds=['G1','G2','OTHER'];
  const profiles=['A','B','C'].map(id=>({id,display_name:id}));
  const base={selectedCohort:'C',cohorts:[{id:'C',name:'Batch 2026'}],profiles,
   enrolments:profiles.map(p=>({cohort_id:'C',user_id:p.id,role:'mentee',active:true})),
   groups:groupIds.map(id=>({id,name:id,cohort_id:'C',active:false,[role+'_id']:id==='OTHER'?'ANOTHER':'STAFF'})),
   members:profiles.map((p,i)=>({user_id:p.id,group_id:groupIds[i],active:true}))};
  const m=await module(await read('context.mjs'),dom.getInternalVMContext(),{'api.mjs':{workspace:async()=>base,rpc:async()=>{}},'session.mjs':{mountSession:async()=>actor}},'https://example.test/assets/grow/context.mjs');
  await m.boot({allowRoster:true});
  assert.equal(m.scope.picking,true);
  assert.equal(m.scope.mentee,null);
  dom.window.document.body.innerHTML=roster.menteeRoster(m.scope,'Review GROW',subject=>m.href('grow-canvas.html',subject));
  const links=[...dom.window.document.querySelectorAll('.roster-list a')];
  assert.deepEqual(links.map(link=>new URL(link.href).searchParams.get('mentee')),['A','B']);
  assert.ok(links.every(link=>new URL(link.href).searchParams.get('period')==='6'));
  dom.window.close();
 }
});

test('Review Mentee keeps the selected mentee on all three review links for both staff roles',async()=>{
 for(const role of ['asmen','mentor']){
  const v=await ui(role,'review');
  assert.equal(v.d.querySelector('h1').textContent,'ACTUAL ASSIGNED NAME');
  const links=[...v.d.querySelectorAll('.card a')];
  assert.deepEqual(links.map(a=>a.textContent),['Leadership Model Canvas','GROW Canvas','Catatan Mentee']);
  assert.ok(links.every(a=>new URL(a.href).searchParams.get('mentee')==='M'));
  v.dom.window.close();
 }
});
