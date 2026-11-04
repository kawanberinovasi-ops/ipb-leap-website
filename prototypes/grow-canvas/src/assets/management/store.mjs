import {TRACKS, trackFor} from '../assessment/curriculum.mjs';
import {buildOperation} from '../assessment/domain.mjs';

export const STORAGE_KEY = 'ipbleap.local.management.v1';
export const ACTOR_KEY = 'ipbleap.local.actor';
export const MANAGER = {id:'00000000-0000-4000-8000-000000000000',display_name:'Pengelola lokal',roles:['program'],active:true};
export const ROLES = {mentee:'Mentee',asmen:'Asisten Mentor',mentor:'Mentor',program:'Pengurus / Pengelola',finance:'Bendahara',system:'Super Admin'};
const empty = () => ({format:1,revision:0,profiles:[],cohorts:[],enrolments:[],groups:[],members:[],records:[],sessions:[],staff:[],audit:[],receipts:[]});
const text = s => String(s ?? '').trim();
const requireValue = (v,label) => {if(!text(v))throw Error('Lengkapi '+label+'.');return text(v);};
const validDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s||'') && !Number.isNaN(Date.parse(s)) && new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
// getRandomValues also works on an HTTP local preview, where randomUUID may be unavailable.
export function localUUID(){const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const h=[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);}

// Browser-local rehearsal only. This is not an authentication or production authorization service.
export function createLocalStore(storage, {uuid=localUUID,now=()=>new Date().toISOString(),notify=()=>{}}={}) {
 function read(){
  let raw;try{raw=storage.getItem(STORAGE_KEY);}catch{throw Error('Penyimpanan browser tidak tersedia. Data belum disimpan.');}
  if(!raw)return empty();
  try{const s=JSON.parse(raw);if(s.format!==1||!Number.isInteger(s.revision)||Object.keys(empty()).some(k=>Array.isArray(empty()[k])&&!Array.isArray(s[k])))throw Error();return s;}
  catch{throw Error('Data lokal tidak dapat dibaca. Data lama tidak dihapus.');}
 }
 function commit(expected,change,description){
  const s=read();if(s.revision!==expected)throw Error('Data berubah di tab lain. Muat ulang daftar sebelum menyimpan; isian tetap tersedia.');
  const result=change(s);s.revision++;
  if(description)s.audit.push({id:uuid(),created_at:now(),actor_id:MANAGER.id,summary:description});
  // Keep the old value intact if quota or browser privacy settings reject this write.
  try{storage.setItem(STORAGE_KEY,JSON.stringify(s));}catch{throw Error('Data belum tersimpan. Ruang penyimpanan browser penuh atau diblokir; isian tetap tersedia.');}
  notify(s.revision);return result;
 }
 function cohort(input,expected){return commit(expected,s=>{
  const name=requireValue(input.name,'nama cohort');if(!validDate(input.starts_on)||!validDate(input.ends_on)||input.ends_on<input.starts_on)throw Error('Isi tanggal mulai dan selesai cohort dengan benar.');
  if(s.cohorts.some(c=>c.name.toLowerCase()===name.toLowerCase()))throw Error('Nama cohort sudah digunakan.');
  const c={id:uuid(),name,starts_on:input.starts_on,ends_on:input.ends_on,revision:0,created_at:now()};s.cohorts.push(c);return c;
 },'Menambahkan cohort '+text(input.name));}
 function account(input,expected){return commit(expected,s=>{
  const name=requireValue(input.display_name,'nama lengkap'),email=requireValue(input.email,'email').toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Alamat email belum benar.');
  if(!Object.hasOwn(ROLES,input.role))throw Error('Pilih peran akun.');
  const c=s.cohorts.find(c=>c.id===input.cohort_id);if(!c)throw Error('Pilih cohort yang tersedia.');
  const p=input.id?s.profiles.find(p=>p.id===input.id):null;if(input.id&&!p)throw Error('Akun tidak ditemukan.');
  if(p&&p.roles[0]!==input.role)throw Error('Peran akun yang sudah digunakan dipertahankan.');
  if(s.profiles.some(p=>p.email===email&&p.id!==input.id))throw Error('Email ini sudah terdaftar pada data lokal.');
  const t=trackFor(input.field);if(input.role==='mentee'&&(!t||(input.pathway&&!t.pathways.includes(input.pathway))))throw Error('Pilih track dan pathway yang sesuai bila sudah ditetapkan.');
  const g=s.groups.find(g=>g.id===input.group_id);
  if(input.group_id&&(!g||g.cohort_id!==c.id||input.role!=='mentee'||g.field!==t?.field))throw Error('Kelompok harus sesuai cohort dan track mentee.');
  const id=p?.id||uuid(),active=input.active!==false;
  if(g&&s.members.filter(m=>m.group_id===g.id&&m.active&&m.user_id!==id).length>=5)throw Error('Kelompok ini sudah berisi lima mentee.');
  if(p){Object.assign(p,{display_name:name,email,active,updated_at:now(),revision:(p.revision||0)+1});}
  else s.profiles.push({id,display_name:name,email,roles:[input.role],active,created_at:now(),updated_at:now(),revision:1,local_only:true});
  let e=s.enrolments.find(e=>e.user_id===id&&e.cohort_id===c.id&&e.role===input.role);
  const assignment={cohort_id:c.id,user_id:id,role:input.role,active,field:input.role==='mentee'?t.field:null,pathway:input.role==='mentee'?input.pathway:null};
  if(e)Object.assign(e,assignment);else s.enrolments.push(assignment);
  if(input.role==='mentee'){
   for(const m of s.members)if(m.user_id===id&&s.groups.some(g=>g.id===m.group_id&&g.cohort_id===c.id))m.active=false;
   if(g){const m=s.members.find(m=>m.user_id===id&&m.group_id===g.id);if(m)m.active=active;else s.members.push({user_id:id,group_id:g.id,active});}
  }
  if(input.role==='program'){
   const grant={cohort_id:c.id,user_id:id,can_manage:true,can_assess:false};const prior=s.staff.find(x=>x.user_id===id&&x.cohort_id===c.id);if(!prior)s.staff.push(grant);
  }
  refreshGroups(s);return id;
 },(input.id?'Memperbarui akun ':'Menambahkan akun lokal ')+text(input.display_name));}
 function group(input,expected){return commit(expected,s=>{
  const name=requireValue(input.name,'nama kelompok'),c=s.cohorts.find(c=>c.id===input.cohort_id),t=trackFor(input.field);if(!c||!t)throw Error('Pilih cohort dan track kelompok.');
  const old=input.id?s.groups.find(g=>g.id===input.id&&g.cohort_id===c.id):null;if(input.id&&!old)throw Error('Kelompok tidak ditemukan.');
  if(s.groups.some(g=>g.id!==input.id&&g.cohort_id===c.id&&g.name.toLowerCase()===name.toLowerCase()))throw Error('Nama kelompok sudah digunakan pada cohort ini.');
  if(old&&old.field!==t.field&&s.members.some(m=>m.group_id===old.id&&m.active))throw Error('Track kelompok yang sudah memiliki mentee dipertahankan.');
  for(const [key,role]of[['mentor_id','mentor'],['asmen_id','asmen']])if(input[key]&&!s.enrolments.some(e=>e.user_id===input[key]&&e.cohort_id===c.id&&e.role===role&&e.active&&s.profiles.some(p=>p.id===e.user_id&&(p.active||p.pending_activation))))throw Error('Pilih pendamping terdaftar pada cohort yang sama.');
  const values={name,cohort_id:c.id,field:t.field,mentor_id:input.mentor_id||null,asmen_id:input.asmen_id||null,updated_at:now()};
  const g=old||{id:uuid(),active:false,created_at:now()};Object.assign(g,values);if(!old)s.groups.push(g);refreshGroups(s);return g;
 },(input.id?'Memperbarui kelompok ':'Menambahkan kelompok ')+text(input.name));}
 function refreshGroups(s){const active=(user,role,c)=>s.profiles.some(p=>p.id===user&&p.active&&p.roles.includes(role))&&s.enrolments.some(e=>e.user_id===user&&e.role===role&&e.cohort_id===c&&e.active);for(const g of s.groups)g.active=active(g.mentor_id,'mentor',g.cohort_id)&&active(g.asmen_id,'asmen',g.cohort_id)&&s.members.filter(m=>m.group_id===g.id&&m.active&&active(m.user_id,'mentee',g.cohort_id)).length===5;}
 function workspace(cohortId,menteeId,actor=MANAGER){
  const s=read(),isManager=actor.id===MANAGER.id||actor.roles.includes('system')||actor.roles.includes('program')&&s.staff.some(x=>x.user_id===actor.id&&x.can_manage);
  const cohorts=s.cohorts.filter(c=>isManager||s.enrolments.some(e=>e.cohort_id===c.id&&e.user_id===actor.id&&e.active)),selectedCohort=cohortId||cohorts.at(-1)?.id||null;
  if(selectedCohort&&!cohorts.some(c=>c.id===selectedCohort))throw Error('Cohort lokal ini tidak tersedia untuk akun yang dipilih.');
  const groups=s.groups.filter(g=>g.cohort_id===selectedCohort&&(isManager||g.mentor_id===actor.id||g.asmen_id===actor.id||s.members.some(m=>m.group_id===g.id&&m.user_id===actor.id&&m.active)));
  const accessible=id=>id===actor.id&&actor.roles.includes('mentee')||groups.some(g=>(g.mentor_id===actor.id||g.asmen_id===actor.id)&&s.members.some(m=>m.group_id===g.id&&m.user_id===id&&m.active));
  const selectedMentee=menteeId&&accessible(menteeId)?menteeId:actor.roles.includes('mentee')?actor.id:s.enrolments.find(e=>e.cohort_id===selectedCohort&&e.role==='mentee'&&e.active&&accessible(e.user_id))?.user_id||null;
  const records=s.records.filter(r=>r.cohort_id===selectedCohort&&r.mentee_id===selectedMentee&&accessible(r.mentee_id)).map(r=>({...r,versions:r.versions.filter(v=>r.kind==='review'?(v.status==='Diterbitkan'||groups.some(g=>g.mentor_id===actor.id)):r.mentee_id===actor.id||v.status!=='Draft')}));
  return {revision:s.revision,actor,cohorts,groups,records,selectedCohort,selectedMentee,enrolments:s.enrolments.filter(e=>e.cohort_id===selectedCohort&&(isManager||e.user_id===actor.id||accessible(e.user_id))),members:s.members.filter(m=>groups.some(g=>g.id===m.group_id)),staff:s.staff.filter(x=>x.cohort_id===selectedCohort),profiles:s.profiles.filter(p=>isManager||p.id===actor.id||accessible(p.id)||groups.some(g=>g.mentor_id===p.id||g.asmen_id===p.id)),sessions:s.sessions.filter(x=>x.cohort_id===selectedCohort),audit:isManager?s.audit:[]};
 }
 function recordCommand(p,actor){
  const old=read().receipts.find(x=>x.id===p.request);if(old){if(old.payload!==JSON.stringify(p))throw Error('ID permintaan sudah digunakan untuk isian berbeda.');return old.result;}
  return commit(p.expected,s=>{
   const w=workspace(p.cohort,p.mentee,actor);if(!actor.active||w.selectedMentee!==p.mentee)throw Error('Mentee lokal tidak dapat diakses.');
   const self=actor.id===p.mentee&&actor.roles.includes('mentee'),g=w.groups.find(g=>s.members.some(m=>m.group_id===g.id&&m.user_id===p.mentee&&m.active));
   const permissions={save:self,submit:self,poc_decide:g?.mentor_id===actor.id&&actor.roles.includes('mentor'),mentoring_check:g?.mentor_id===actor.id&&actor.roles.includes('mentor'),abc_check:g?.asmen_id===actor.id&&actor.roles.includes('asmen'),commitment:g?.asmen_id===actor.id&&actor.roles.includes('asmen'),process:g?.asmen_id===actor.id&&actor.roles.includes('asmen'),evidence:g?.asmen_id===actor.id&&actor.roles.includes('asmen'),review_save:g?.mentor_id===actor.id&&actor.roles.includes('mentor')&&Number(p.month)!==12,publish:g?.mentor_id===actor.id&&actor.roles.includes('mentor')&&Number(p.month)!==12};
   if(!permissions[p.action])throw Error('Tindakan ini bukan kewenangan peran lokal yang dipilih.');
   const op=buildOperation(w,p);let r=s.records.find(r=>r.id===p.id);
   if(!r){if(s.records.some(r=>r.cohort_id===p.cohort&&r.mentee_id===p.mentee&&r.kind===op.kind&&r.month_no===op.month&&!['abc','checkin'].includes(op.kind)))throw Error('Catatan periode ini sudah ada. Buka versi yang tersimpan.');r={id:p.id,cohort_id:p.cohort,mentee_id:p.mentee,kind:op.kind,month_no:op.month,session_id:op.session||null,versions:[],checks:[],publications:[]};s.records.push(r);}
   const v={id:uuid(),record_id:r.id,number:r.versions.length+1,status:op.status,data:op.data,created_at:now(),actor_id:actor.id,action:p.action};
   if(op.check)r.checks.push({id:uuid(),record_id:r.id,kind:op.check.kind,source_version_id:op.check.source,data:op.check.data,actor_id:actor.id,created_at:now()});
   if(op.data){r.versions.push(v);r.latest_status=op.status;r.latest_version=v.number;}
   if(op.score)r.publications.push({id:uuid(),record_id:r.id,version_id:v.id,number:r.publications.length+1,score:op.score,sources:op.sources,created_at:now(),actor_id:actor.id});
   r.updated_at=now();const result={ok:true,revision:s.revision+1};s.receipts.push({id:p.request,payload:JSON.stringify(p),result});s.receipts=s.receipts.slice(-200);return result;
  },null);
 }
 return {read,cohort,account,group,workspace,recordCommand};
}

export function participantProgress(s,userId,cohortId){
 const records=s.records.filter(r=>r.mentee_id===userId&&r.cohort_id===cohortId),last=kind=>records.filter(r=>r.kind===kind).sort((a,b)=>String(a.updated_at).localeCompare(String(b.updated_at))).at(-1);
 const mentoring=records.filter(r=>r.kind==='mentoring'),contract=last('poc'),actual=last('actual');
 const publications=records.filter(r=>r.kind==='review').flatMap(r=>r.publications.map(p=>({...p,period:r.month_no}))).sort((a,b)=>a.period-b.period||a.number-b.number);
 const latest=publications.at(-1),updated=records.map(r=>r.updated_at).filter(Boolean).sort().at(-1)||null;
 return {mentoring:mentoring.length,submittedMentoring:mentoring.filter(r=>r.latest_status!=='Draft').length,contract:contract?.latest_status||'Belum diisi',actual:actual?.latest_status||'Belum diisi',publication:latest||null,updated,records,needsReview:records.filter(r=>r.latest_status==='Diajukan').length};
}

let instance;
export function localStore(){return instance??=createLocalStore(window.localStorage,{notify:()=>window.dispatchEvent(new CustomEvent('leap:local-data'))});}
export function localActor(){const id=sessionStorage.getItem(ACTOR_KEY);return localStore().read().profiles.find(p=>p.id===id&&p.active)||MANAGER;}
export {TRACKS};
