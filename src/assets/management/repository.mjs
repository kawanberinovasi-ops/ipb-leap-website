import {localStore,localActor,ACTOR_KEY,TRACKS} from './store.mjs?v=20261103-password';

export const isLocal=()=>document.documentElement.dataset.leapLocal==='true';
export async function openRepository({cohort=null,management=true}={}){
 if(isLocal()){if(new URLSearchParams(location.search).get('pengelola')==='1'){sessionStorage.removeItem(ACTOR_KEY);sessionStorage.removeItem('ipbleap.ui.role');}return {store:localStore(),actor:localActor(),local:true};}
 const api=await import('../assessment/api.mjs');
 if(!await api.verifiedUser()){
  const next=location.pathname+location.search;
  location.replace(new URL('index.html?next='+encodeURIComponent(next),api.appBase));
  throw Error('Masuk dengan akun IPB LEAP untuk melanjutkan.');
 }
 const actor=await api.bootstrap();if(!actor.active)throw Error('Akun belum diaktifkan.');
 const manage=management==='attendance'?actor.roles.includes('program')&&new URLSearchParams(location.search).get('mentee')!==actor.id:management;
 let cache;
 const reload=async(c=cohort)=>{
  cohort=c;
  cache=manage?await api.rpc('erp_management_workspace',{p_cohort:c||null}):await api.workspace(c||null);
  cache.revision??=cache.cohorts.find(x=>x.id===cache.selectedCohort)?.revision||0;
  cache.audit??=[];return cache;
 };
 await reload();
 const validateTrack=data=>{if(data.role==='mentee'&&!TRACKS.some(t=>t.field===data.field&&(!data.pathway||t.pathways.includes(data.pathway))))throw Error('Pilih track dan pathway yang sesuai bila sudah ditetapkan.');};
 const store={read:()=>cache,reload,
  async cohort(data){if(!actor.roles.includes('system'))throw Error('Super Admin menyiapkan cohort.');const result=await api.command('create_cohort',data);await reload(result.cohort);return cache.cohorts.find(c=>c.id===result.cohort);},
  async account(data,expected){validateTrack(data);if(data.id){await api.rpc('erp_management_command',{p_payload:{...data,action:'account',cohort:data.cohort_id,user:data.id},p_expected:expected});return null;}
   if(data.group_id)throw Error('Aktifkan akun terlebih dahulu, kemudian tempatkan ke kelompok melalui Edit.');
   return api.accountCommand({action:'create',cohort:data.cohort_id,name:data.display_name,email:data.email,roles:[data.role],field:data.field,pathway:data.pathway,expected,...(data.initial_password?{initial_password:data.initial_password}:{})});
  },
  group:(data,expected)=>api.rpc('erp_management_command',{p_payload:{...data,action:'group',cohort:data.cohort_id},p_expected:expected}),
  reissue:(user,c)=>api.accountCommand({action:'reissue',user,cohort:c})
 };
 return {store,actor,local:false};
}
