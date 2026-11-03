import * as api from '../assessment/api.mjs';
import {programMonth,today} from '../assessment/domain.mjs';
export const currentDate=today;
export function staffRole(actor,preferred){return ['asmen','mentor'].includes(preferred)&&actor.roles.includes(preferred)?preferred:['asmen','mentor'].find(r=>actor.roles.includes(r))||null;}
export async function loadGroupContext(cohortId,groupId,preferred){
 const base=await api.workspace(cohortId||null,null),actor=base.actor,role=staffRole(actor,preferred);
 const groups=base.groups.filter(g=>role&&g[role==='asmen'?'asmen_id':'mentor_id']===actor.id);
 if(groupId&&!groups.some(g=>g.id===groupId))throw Error('Kelompok ini tidak ditugaskan kepada akunmu.');
 const group=groups.find(g=>g.id===groupId)||groups[0]||null,cohort=base.cohorts.find(c=>c.id===(group?.cohort_id||base.selectedCohort));
 if(!group)return{actor,role,groups,group,cohort,profiles:base.profiles,people:[],logs:[],month:cohort?programMonth(cohort.starts_on):1};
 const ids=base.members.filter(m=>m.group_id===group.id&&m.active&&base.enrolments.some(e=>e.user_id===m.user_id&&e.role==='mentee'&&e.active)).map(m=>m.user_id);
 const [details,state]=await Promise.all([Promise.all(ids.map(id=>api.workspace(group.cohort_id,id))),api.rpc('erp_group_session_command',{p_action:'state',p_payload:{group:group.id}})]);
 const people=ids.map((id,i)=>({id,name:base.profiles.find(p=>p.id===id)?.display_name||'Nama belum tersedia',enrolment:base.enrolments.find(e=>e.user_id===id&&e.role==='mentee'),records:details[i].selectedMentee===id?details[i].records:[]}));
 return{actor,role,groups,group,cohort,profiles:base.profiles,people,logs:state.logs,month:programMonth(cohort.starts_on)};
}
export const saveGroupSession=p=>api.rpc('erp_group_session_command',{p_action:'save',p_payload:p});
export function personSummary(person,logs,month){
 const submitted=person.records.filter(r=>r.month_no===month&&['abc','mentoring','checkin','actual','portfolio'].includes(r.kind)&&r.versions?.length&&r.versions.at(-1).status!=='Draft').sort((a,b)=>String(a.updated_at).localeCompare(String(b.updated_at)));
 const checks=person.records.flatMap(r=>r.month_no===month?(r.checks||[]).filter(c=>c.kind==='process'):[]).sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));
 const publications=person.records.filter(r=>r.kind==='review').flatMap(r=>(r.publications||[]).map(p=>({...p,period:r.month_no}))).filter(p=>typeof p.score?.total==='number').sort((a,b)=>a.period-b.period||a.number-b.number);
 const attendance=logs.filter(s=>s.status==='Tercatat').flatMap(s=>s.data.attendance||[]).filter(a=>a.user_id===person.id&&['Hadir','Izin','Absen'].includes(a.status));
 return{last:submitted.at(-1)||null,process:checks.at(-1)?.data||null,publication:publications.at(-1)||null,attendance:attendance.length?Math.round(attendance.filter(a=>a.status==='Hadir').length*100/attendance.length):null};
}
export function groupSummary(context){
 const people=context.people.map(p=>({...p,...personSummary(p,context.logs,context.month)}));
 const counts={Green:0,Yellow:0,Red:0,none:0};for(const p of people)counts[Object.hasOwn(counts,p.process?.color)?p.process.color:'none']++;
 const attendance=context.logs.filter(s=>s.status==='Tercatat').flatMap(s=>s.data.attendance||[]).filter(a=>['Hadir','Izin','Absen'].includes(a.status));
 const scores=people.filter(p=>p.publication).map(p=>p.publication.score.total);
 return{people,counts,updated:people.filter(p=>p.last).length,attendance:attendance.length?Math.round(attendance.filter(a=>a.status==='Hadir').length*100/attendance.length):null,score:scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:null};
}
