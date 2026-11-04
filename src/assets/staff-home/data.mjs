import {workspace} from '../assessment/api.mjs';
import {loadGroupContext} from '../groups/data.mjs?v=20261104-grow';
import {portalWorkspace} from '../portal/api.mjs';
export async function loadStaffHome(actor,role,cohortId=null){
 if(!['asmen','mentor'].includes(role)||!actor.roles?.includes(role))throw Error('Beranda ini hanya tersedia untuk pendamping sesuai peran akun.');
 const base=await workspace(cohortId,null),cohort=base.cohorts.find(c=>c.id===base.selectedCohort)||base.cohorts[0];
 if(!cohort||cohortId&&cohort.id!==cohortId)throw Error('Batch belum tersedia untuk akun ini.');
 const groups=base.groups.filter(g=>g.cohort_id===cohort.id&&g[role==='asmen'?'asmen_id':'mentor_id']===actor.id);
 const results=await Promise.allSettled(groups.map(g=>loadGroupContext(cohort.id,g.id,role)));
 const contexts=results.flatMap(r=>r.status==='fulfilled'?[r.value]:[]),errors=results.flatMap((r,i)=>r.status==='rejected'?[{group:groups[i].name,message:r.reason?.message||'Data kelompok belum dapat dimuat.'}]:[]);
 const ids=new Set(base.members.filter(m=>m.active&&groups.some(g=>g.id===m.group_id)&&base.enrolments.some(e=>e.user_id===m.user_id&&e.cohort_id===cohort.id&&e.role==='mentee'&&e.active)).map(m=>m.user_id));
 let portal=null,portalError='';try{portal=await portalWorkspace(cohort.id);}catch(e){portalError=e.message||'Pengumuman dan agenda belum dapat dimuat.';}
 return{actor,role,cohort,groups,contexts,errors,menteeCount:ids.size,portal,portalError};
}
export function homeSummary(home){
 const tasks=[],people=new Map(),logs=[];let period=3;
 for(const ctx of home.contexts){
  period=Math.ceil(Math.max(1,Math.min(12,ctx.month))/3)*3;
  for(const person of ctx.people){
   people.set(person.id,person);const w=person.grow;if(!w)continue;
   const add=(kind,title,detail,file,extra={})=>tasks.push({kind,title,detail,person:person.name,group:ctx.group.name,mentee:person.id,groupId:ctx.group.id,file,extra});
   if(home.role==='asmen'){
    if(w.canvas?.status==='Diajukan')add('grow','Periksa GROW', 'Pengajuan awal menunggu pemeriksaan kelengkapan.','grow-canvas.html');
    for(const n of w.notes.filter(n=>n.status==='Diajukan'))if((n.outcome?.status==='Selesai'||n.data.due<w.today)&&(!n.check||n.check.outcomeRevision!==n.outcomeRevision))add('action','Periksa tindak lanjut',n.data.action,'raport.html',{note:n.id,period:n.period});
   }else{
    if(w.canvas?.status==='Siap dibahas Mentor')add('grow','Sepakati GROW','Kelengkapan sudah diperiksa Asmen.','grow-canvas.html');
    if(w.canvas?.status==='Disepakati'&&w.scores?.[period]?.mentor==null)add('review','Review milestone M'+period,'Bandingkan hasil dan bukti dengan target tiap KPI.','raport.html',{period});
    const needs=[];if(w.canvas?.status!=='Draft'&&w.canvas?.data.mentorNeed&&!/^tidak ada\.?$/i.test(w.canvas.data.mentorNeed.trim()))needs.push({key:'canvas',text:w.canvas.data.mentorNeed,file:'grow-canvas.html'});
    for(const n of w.notes)if(n.status==='Diajukan'&&n.data.mentorNeed?.trim())needs.push({key:n.id,text:n.data.mentorNeed,file:'mentoring.html'});
    for(const need of needs)if(w.supportReplies?.[need.key]?.status!=='Ditindaklanjuti')add('support','Tanggapi kebutuhan mentee',need.text,need.file);
   }
  }
  logs.push(...ctx.logs.filter(l=>l.status==='Tercatat').map(l=>({...l,group:ctx.group})));
 }
 const now=new Date(),announcements=(home.portal?.announcements||[]).filter(a=>!a.withdrawn_at&&new Date(a.publish_at)<=now).sort((a,b)=>String(b.publish_at).localeCompare(String(a.publish_at))).slice(0,4);
 const upcoming=(home.portal?.activities||[]).filter(a=>!a.cancelled&&!a.cancelled_at&&new Date(a.ends_at||a.starts_at)>=now).sort((a,b)=>String(a.starts_at).localeCompare(String(b.starts_at))).slice(0,4);
 const published=[...people.values()].filter(p=>p.grow?.publications.some(x=>x.period===period)).length;
 return{tasks,period,published:home.errors.length?null:published,priorities:home.errors.length?null:tasks.length,announcements,upcoming,logs:logs.sort((a,b)=>String(b.data.date).localeCompare(String(a.data.date))).slice(0,4)};
}
