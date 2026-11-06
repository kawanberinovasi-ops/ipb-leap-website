import {workspace,rpc} from '../assessment/api.mjs';
import {mountSession} from '../assessment/session.mjs';
export const catalog=await fetch(new URL('./catalog.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Katalog KPI belum dapat dimuat.');return r.json();});
export let role='mentee',track,currentTrack,scope={};
const query=new URLSearchParams(location.search);
export function href(file,extra={}){
 const u=new URL(file,location.href);const legacy=/\/(progres|monitoring-progres|penilaian)\.html$/.exec(u.pathname);
 if(legacy){u.pathname=u.pathname.replace(/[^/]+$/,'raport.html');u.hash=legacy[1]==='penilaian'?'penilaian':'tindak-lanjut';}
 u.search='';for(const[k,v]of Object.entries({cohort:scope.cohort?.id,mentee:scope.mentee,group:scope.group?.id,period:query.get('period')||undefined,...extra}))if(v!==undefined&&v!==null)u.searchParams.set(k,v);
 return u.pathname+u.search+u.hash;
}
export async function boot({requireTrack=true,allowRoster=false}={}){
 const actor=await mountSession();if(!actor)return false;
 const preferred=sessionStorage.getItem('ipbleap.ui.role'),candidate=actor.roles.includes(preferred)?preferred:actor.roles[0];
 const base=await workspace(query.get('cohort'),null);
 const cohort=base.cohorts.find(c=>c.id===base.selectedCohort)||base.cohorts[0];if(!cohort)throw Error('Belum ada batch aktif untuk akun ini.');
 const enrolled=base.enrolments.filter(e=>e.cohort_id===cohort.id&&e.active);
 const own=enrolled.some(e=>e.user_id===actor.id&&e.role==='mentee');
 role=own&&(!query.has('mentee')||query.get('mentee')===actor.id)&&candidate==='mentee'?'mentee': ['asmen','mentor'].includes(candidate)?candidate:own?'mentee':actor.roles.find(r=>['asmen','mentor'].includes(r))||'program';
 const staff=['asmen','mentor'].includes(role);
 const picking=allowRoster&&staff&&!query.has('mentee');
 const groups=base.groups.filter(g=>!g.archived_at&&g.cohort_id===cohort.id&&(role==='mentee'?base.members.some(m=>m.group_id===g.id&&m.user_id===actor.id&&m.active):g[role==='asmen'?'asmen_id':'mentor_id']===actor.id));
 if(query.has('group')&&!groups.some(g=>g.id===query.get('group')))throw Error('Kelompok ini tidak ditugaskan kepada akunmu.');
 const group=groups.find(g=>g.id===query.get('group'))||groups.find(g=>query.has('mentee')&&base.members.some(m=>m.active&&m.group_id===g.id&&m.user_id===query.get('mentee')))||(picking?null:groups[0])||null;
 const people=role==='mentee'?[{id:actor.id,name:actor.display_name}]:base.members.filter(m=>m.active&&groups.some(g=>g.id===m.group_id)&&(!group||m.group_id===group.id)&&enrolled.some(e=>e.user_id===m.user_id&&e.role==='mentee')).map(m=>({id:m.user_id,groupId:m.group_id,name:base.profiles.find(p=>p.id===m.user_id)?.display_name||'Nama belum tersedia'}));
 const mentee=picking?null:query.get('mentee')||(role==='mentee'?actor.id:people[0]?.id);
 if(!picking&&!mentee)throw Error('Belum ada mentee ditugaskan. Pengurus perlu melengkapi penempatan kelompok.');
 if(!picking&&!people.some(p=>p.id===mentee))throw Error('Mentee ini tidak ditugaskan kepada akunmu.');
 const enrolment=enrolled.find(e=>e.role==='mentee'&&e.user_id===mentee);
 currentTrack=catalog.find(t=>t.track===enrolment?.field);if(!picking&&requireTrack&&!currentTrack)throw Error('Track mentee belum ditetapkan. Hubungi pengelola.');track=currentTrack?.id;
 scope={actor,cohort,group,groups,people,mentee,enrolment,picking};window.leapCohortName=cohort.name;sessionStorage.setItem('ipbleap.ui.role',role);window.dispatchEvent(new CustomEvent('leap:account'));return true;
}
export const loadWorkspace=()=>rpc('erp_grow_state',{p_cohort:scope.cohort.id,p_mentee:scope.mentee,p_role:role});
export const sendCommand=(action,data,expected)=>rpc('erp_grow_command',{p_cohort:scope.cohort.id,p_mentee:scope.mentee,p_action:action,p_data:data,p_expected:expected});
