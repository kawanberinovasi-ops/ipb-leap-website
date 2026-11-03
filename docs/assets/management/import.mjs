import {TRACKS} from './store.mjs?v=20261103-onboarding';

// Roster files stay in the operator's browser. Only validated account fields
// are sent through the existing authenticated, cohort-scoped account service.
export function validateRoster(raw,profiles=[]){
 if(!Array.isArray(raw)||!raw.length||raw.length>500)throw Error('Isi daftar 1–500 peserta.');
 const seen=new Set(),existing=new Set(profiles.map(p=>p.email.toLowerCase()));
 return raw.map((r,i)=>{
  const display_name=String(r.display_name??'').trim(),email=String(r.email??'').trim().toLowerCase(),role=r.role,field=String(r.field??'').trim();
  if(display_name.length<2||display_name.length>100)throw Error('Nama belum benar pada baris '+(i+1)+'.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>200)throw Error('Email belum benar pada baris '+(i+1)+'.');
  if(!['mentee','asmen'].includes(role))throw Error('Impor hanya untuk Mentee dan Asisten Mentor.');
  if(!TRACKS.some(t=>t.field===field))throw Error('Track belum benar pada baris '+(i+1)+'.');
  if(seen.has(email))throw Error('Email berulang dalam daftar: '+email);seen.add(email);
  if(r.pathway||r.group_id)throw Error('Impor ini menggunakan pathway dan kelompok kosong.');
  return {display_name,email,role,field,pathway:'',group_id:'',existing:existing.has(email)};
 });
}

export async function provisionRoster(rows,{store,cohort,onProgress=()=>{}}){
 const results=[];
 for(const row of rows){
  const {existing,...data}=row;
  if(existing){results.push({...data,status:'Sudah terdaftar',url:''});onProgress(results);continue;}
  try{
   // Refresh before each request so concurrent operator changes are detected.
   await store.reload(cohort);
   if(store.read().profiles.some(p=>p.email.toLowerCase()===data.email)){
    results.push({...data,status:'Sudah terdaftar',url:''});onProgress(results);continue;
   }
   const activation=await store.account({...data,cohort_id:cohort},store.read().revision);
   if(!activation?.url)throw Error('Layanan belum mengembalikan tautan aktivasi.');
   results.push({...data,status:'Menunggu aktivasi',url:activation.url});
  }catch(e){results.push({...data,status:'Perlu diperiksa: '+e.message,url:''});}
  onProgress(results);
 }
 await store.reload(cohort);return results;
}

export function activationCSV(results){
 // Prevent spreadsheet formula execution in source-controlled or imported names.
 const cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
 return '\ufeff'+[['Nama','Email','Peran','Track','Pathway','Kelompok','Status','Tautan aktivasi pribadi'],...results.map(r=>[r.display_name,r.email,r.role,r.field,'','',r.status,r.url])].map(r=>r.map(cell).join(',')).join('\r\n');
}
