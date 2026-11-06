// Local review harness. It serves built frontend files against disposable fixtures.
import assert from 'node:assert/strict';
import http from 'node:http';import path from 'node:path';import fs from 'node:fs/promises';
import {createDB,as,id,actors} from '../tests/fixtures/database.mjs';
import {blocks,blockLimit} from '../src/assets/dmc/blocks.mjs';
const root=path.resolve('docs');
const profileSql=await fs.readFile('backend/erp/integrations/profile-details.sql','utf8');
const groupsSql=await fs.readFile('backend/erp/integrations/group-live-data.sql','utf8');
const migration=(await fs.readdir('supabase/migrations')).find(x=>x.endsWith('_grow_canvas_authenticated.sql'));
const growSql=await fs.readFile('supabase/migrations/'+migration,'utf8');
async function createCase(){
 const database=await createDB();
 await database.exec(groupsSql);
 await database.exec(growSql);
 await database.exec(profileSql);
 await database.query("update erp_enrolments set field='Social & Community / Social Impact' where user_id=$1",[id(1)]);
 return database;
}
const [db,blank]=await Promise.all([createCase(),createCase()]);
const names={mentee:'Mentee Uji',asmen:'Asmen Uji',mentor:'Mentor Uji'};
let revision=0;
async function step(role,action,data) {
 await as(db,role);
 const result=(await db.query('select erp_grow_command($1,$2,$3,$4::jsonb,$5) s',
  [id(20),id(1),action,JSON.stringify(data),revision])).rows[0].s;
 revision=result.revision;
 return result;
}
async function readAs(role) {
 await as(db,role);
 return (await db.query('select erp_grow_state($1,$2,$3) s',[id(20),id(1),role])).rows[0].s;
}
const catalog=JSON.parse(await fs.readFile('src/assets/grow/catalog.json','utf8'));
const kpi=catalog.find(t=>t.id==='social').kpis.find(k=>k.id==='socialBeneficiaries');
await step('mentee','canvas_submit',{
 goal:'Memperluas manfaat program komunitas',why:'Warga membutuhkan akses pendampingan',
 reality:'Satu kegiatan sudah berjalan',options:'Mengajak mitra lokal',wayForward:'Mendata peserta terverifikasi',
 mentorNeed:'Masukan untuk cara verifikasi penerima manfaat',
 kpis:[{id:kpi.id,baseline:'0 orang',measurement:'Rekap peserta terverifikasi',milestones:{3:'100 orang',6:'200 orang',9:'350 orang',12:kpi.label}}]
});
await step('asmen','canvas_check',{decision:'Siap dibahas Mentor',comment:'Target dan cara ukur sudah diperiksa.'});
await step('mentor','canvas_agree',{comment:'Target disepakati.'});
const note=(await step('mentee','note_submit',{data:{
 date:'2025-01-02',due:'2025-01-04',learning:'Perlu verifikasi peserta',action:'Rekap peserta',
 kind:'1-on-1',format:'Online',time:'10:30'
}})).notes.at(-1).id;
await step('mentee','outcome_save',{id:note,status:'Selesai',result:'75 orang terverifikasi',completed:'2025-01-04'});
await step('asmen','action_check',{id:note,execution:10,timeliness:10,evidence:5,comment:'Bukti rekap diperiksa.'});
await step('mentor','review_save',{period:3,items:[
 {id:kpi.id,actual:'75 orang',evidence:'Rekap peserta terverifikasi',level:75,reason:'75 dari target 100 orang.'}
]});
assert.equal((await readAs('mentee')).scores['3'].total,null);
await step('mentor','publish',{period:3});
assert.equal((await readAs('mentee')).scores['3'].total,77.5);
await as(blank,'mentee');
const blankState=(await blank.query('select erp_grow_state($1,$2,$3) s',[id(20),id(1),'mentee'])).rows[0].s;
assert.equal(blankState.canvas,null);
assert.deepEqual(blankState.publications,[]);

for(const [database,name] of [[blank,'Batch 1 · Versi kosong'],[db,'Batch 1 · Contoh terisi']]){
 await database.exec('reset role');
 await database.query("update erp_cohorts set name=$1, starts_on='2026-11-01', ends_on='2027-10-31' where id=$2",[name,id(20)]);
}
const sampleBlocks=Object.fromEntries(blocks.map(({id},index)=>[id,[
 'Remaja usia 13–17 tahun di dua desa mitra.',
 'Kelas literasi digital untuk belajar menggunakan internet dengan aman.',
 'Pengumuman melalui sekolah dan komunitas pemuda.',
 'Undang peserta memberi umpan balik setelah kelas dan hubungi alumni tiap bulan.',
 'Menjangkau 500 peserta unik terverifikasi sampai akhir program.',
 'Relawan fasilitator, modul, ruang belajar, dan formulir rekap.',
 'Merekrut fasilitator, mengadakan kelas, dan memverifikasi peserta.',
 'Sekolah menyiapkan ruang. Karang taruna membantu mengajak peserta.',
 'Anggaran untuk transportasi, cetak modul, dan akses internet.',
][index]]));
const freshCanvas=()=>({revision:0,draft:null,shared:null});
const cases={
 kosong:{label:'Versi kosong',db:blank,canvas:freshCanvas(),email:new Map(),pendingEmail:new Map()},
 terisi:{label:'Contoh terisi',db,canvas:{...freshCanvas(),revision:1,shared:sampleBlocks},email:new Map(),pendingEmail:new Map()},
};
const port=Number(process.env.IPBLEAP_PREVIEW_PORT||8793);
const origin='http://127.0.0.1:'+port;
const roles=['mentee','asmen','mentor'];
const labels={mentee:'Mentee',asmen:'Asmen',mentor:'Mentor'};
const dmcPath='/app/development-model-canvas.html';
const launch=`<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pratinjau · IPB LEAP</title>
<style>
 body{margin:0;background:#f5f7fc;color:#1d2140;font:16px/1.55 system-ui,sans-serif}main{max-width:820px;margin:auto;padding:36px 20px}
 img{width:86px}h1,h2{color:#32306f;margin:0}h1{font-size:clamp(28px,5vw,48px);line-height:1.1}
 section{margin-top:26px;background:white;border:1px solid #dce2f2;border-radius:18px;padding:20px}
 .links{display:flex;gap:12px;flex-wrap:wrap;margin-top:14px}a{background:#32306f;border-radius:12px;color:white;text-decoration:none;padding:10px 14px;font-weight:700}a:focus-visible{outline:3px solid #3157a5;outline-offset:3px}
</style><main><img src="/assets/logo-color.png" alt="IPB LEAP"><p>IPB LEAP · Pratinjau lokal</p><h1>Leadership Model Canvas</h1>
<p>Buka akun uji dalam tab terpisah. Tab dari versi yang sama berbagi data contoh.</p>
${Object.entries(cases).map(([key,{label}])=>`<section><h2>${label}</h2><div class="links">${roles.map(role=>`<a href="${dmcPath}?kasus=${key}&amp;akun-lokal=${role}" target="_blank" rel="noopener">${labels[role]}</a>`).join('')}</div></section>`).join('')}
</main></html>`;

const setup=`<script>
const localRoleKey='ipbleap.consultation.role';
const localCaseKey='ipbleap.consultation.case';
const params=new URLSearchParams(location.search);
const selectedRole=params.get('akun-lokal');
const selectedCase=params.get('kasus');
if (['mentee','asmen','mentor'].includes(selectedRole)&&['kosong','terisi'].includes(selectedCase)) {
  sessionStorage.setItem(localCaseKey,selectedCase);
  sessionStorage.setItem(localRoleKey,selectedRole);
  sessionStorage.setItem('ipbleap.ui.role',selectedRole);
}
if (!sessionStorage.getItem(localRoleKey)||!sessionStorage.getItem(localCaseKey)) location.replace('/');
</script>`;
const banner=`<aside style="position:relative;z-index:51;padding:10px 14px;background:#e4edf9;color:#222653;display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;font:600 13px system-ui">
<strong id="local-account-label">Pratinjau lokal</strong>
<a href="/app/pengaturan.html">Pengaturan</a>
<a href="/" target="_blank" rel="noopener">Buka tab akun lain</a>
<button id="local-confirm-email" type="button" hidden>Simulasikan konfirmasi email</button>
<span id="local-email-result" role="status"></span>
</aside>
<script type="module">
const activeLocalRole=sessionStorage.getItem(localRoleKey);
document.getElementById('local-account-label').textContent=(sessionStorage.getItem(localCaseKey)==='kosong'?'Versi kosong':'Contoh terisi')+' · '+({mentee:'Mentee',asmen:'Asmen',mentor:'Mentor'}[activeLocalRole]||'Pilih akun');
if(location.pathname==='/app/pengaturan.html'){
 const button=document.getElementById('local-confirm-email');
 button.hidden=false;
 button.onclick=async()=>{
  try{
   const {rpc}=await import('/assets/assessment/api.mjs');
   await rpc('qa_confirm_email');
   location.reload();
  }catch(error){document.getElementById('local-email-result').textContent=error.message;}
 };
}
</script>`;

const api=`
export const configured=true,appBase=new URL('../../app/',import.meta.url);
export const errorText=e=>e.message,safeNext=v=>v;
const roleKey='ipbleap.consultation.role';
const call=async(name,args={})=>{
 const r=await fetch('/__grow_qa/rpc',{method:'POST',headers:{
  'Content-Type':'application/json','X-Local-Account':sessionStorage.getItem(roleKey)||'',
  'X-Local-Case':sessionStorage.getItem('ipbleap.consultation.case')||''
 },body:JSON.stringify({name,args})});
 const data=await r.json();
 if(!r.ok)throw Error(data.error);
 return data;
};
export const rpc=call,workspace=(c=null,u=null)=>call('erp_workspace',{p_cohort:c,p_mentee:u}),
 bootstrap=()=>call('qa_actor'),verifiedUser=async()=>({id:(await bootstrap()).id});
export const client={auth:{updateUser:async({email})=>{
 try{return {data:await call('qa_email_request',{email}),error:null};}
 catch(error){return {data:null,error};}
},onAuthStateChange:()=>({data:{subscription:{}}}),signOut:async()=>{
 sessionStorage.removeItem(roleKey);return {error:null};
}}};
export const command=()=>{throw Error('Fitur ini berada di luar ruang konsultasi.')},revision=()=>0,recordCommand=command,accountCommand=command;
`;
const operations={
 erp_profile_details:['select erp_profile_details($1::jsonb) result',a=>[a.p_patch?JSON.stringify(a.p_patch):null]],
 erp_workspace:['select erp_workspace($1,$2) result',a=>[a.p_cohort,a.p_mentee]],
 erp_grow_state:['select erp_grow_state($1,$2,$3) result',a=>[a.p_cohort,a.p_mentee,a.p_role]],
 erp_grow_command:['select erp_grow_command($1,$2,$3,$4::jsonb,$5) result',a=>[a.p_cohort,a.p_mentee,a.p_action,JSON.stringify(a.p_data),a.p_expected]],
};
let queue=Promise.resolve();
function run(job) {
 const next=queue.then(job,job);
 queue=next.catch(()=>{});
 return next;
}
const types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.JPG':'image/jpeg','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const isAppView=pathname=>/^\/app\/[a-z0-9-]+\.html$/.test(pathname);
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Content-Security-Policy',"default-src 'self';script-src 'self' 'unsafe-inline' 'unsafe-eval';style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;font-src 'self' https://fonts.gstatic.com;connect-src 'self';img-src 'self' data:");
 try{
  if(req.headers.host!=='127.0.0.1:'+port)throw Error('Buka ruang latihan lewat '+origin+'.');
  const url=new URL(req.url,origin);
  if(url.pathname==='/__grow_qa/rpc'){
   const role=req.headers['x-local-account'];
   const scenario=req.headers['x-local-case'];
   if(req.method!=='POST'||!roles.includes(role)||!Object.hasOwn(cases,scenario)||(req.headers.origin&&req.headers.origin!==origin)){
    res.writeHead(403,{'Content-Type':'application/json'});
    res.end(JSON.stringify({error:'Pilih salah satu akun latihan dari halaman awal.'}));
    return;
   }
   let raw='';
   for await(const chunk of req){
    raw+=chunk;
    if(raw.length>100000)throw Error('Isian terlalu panjang.');
   }
   const {name,args={}}=JSON.parse(raw);
   const result=await run(async()=>{
    const fixture=cases[scenario];
    const {db:database,canvas,email,pendingEmail}=fixture;
    const currentEmail=email.get(role)||role+'@example.test';
    await as(database,role);
    if(name==='qa_actor')return{id:id(actors[role]),display_name:names[role],roles:[role],active:true,email:currentEmail};
    if(name==='erp_portal_workspace'){
     if(args.p_cohort&&args.p_cohort!==id(20))throw Error('Batch tidak tersedia.');
     const workspace=(await database.query('select erp_workspace($1,$2) result',[id(20),null])).rows[0].result;
     return {...workspace,canManage:false,activities:[],announcements:scenario==='terisi'?[{
      id:id(70),title:'Pengumuman contoh IPB LEAP',body:'Ini contoh pengumuman untuk menguji notifikasi.',
      publish_at:'2026-11-01T00:00:00Z',withdrawn_at:null,audience_all:true,roles:[],group_ids:[],user_ids:[],pinned:true,important:false,
     }]:[]};
    }
    if(name==='qa_email_request'){
     if(!/^[^\s@]+@[^\s@]+$/.test(args.email)||args.email===currentEmail)throw Error('Masukkan email baru yang valid.');
     pendingEmail.set(role,args.email);
     return {};
    }
    if(name==='qa_confirm_email'){
     if(!pendingEmail.has(role))throw Error('Ajukan perubahan email dari Pengaturan terlebih dahulu.');
     email.set(role,pendingEmail.get(role));
     pendingEmail.delete(role);
     return {};
    }
    if(['erp_dmc_state','erp_dmc_save'].includes(name)){
     if(args.p_cohort!==id(20)||args.p_mentee!==id(1))throw Error('Mentee tidak ditugaskan kepada akunmu.');
     if(name==='erp_dmc_state'){
      if(args.p_role!==role)throw Error('Peran akun tidak sesuai.');
      return role==='mentee'?canvas:{shared:canvas.shared};
     }
     if(role!=='mentee')throw Error('Hanya mentee yang dapat menyimpan canvas.');
     if(canvas.revision!==args.p_expected)throw Error('Canvas berubah di tab lain. Salin isian lalu muat ulang.');
     const values=Object.fromEntries(blocks.map(({id})=>{
      const value=args.p_blocks?.[id];
      if(typeof value!=='string'||value.length>blockLimit)throw Error('Isian blok tidak valid.');
      return [id,value.trim()];
     }));
     if(args.p_share){
      if(!Object.values(values).some(Boolean))throw Error('Isi minimal satu blok sebelum membagikan canvas.');
      canvas.shared=values;
      canvas.draft=null;
     }else{canvas.draft=values;}
     canvas.revision++;
     return canvas;
    }
    if(!Object.hasOwn(operations,name))throw Error('Fitur ini berada di luar ruang konsultasi.');
    const [sql,values]=operations[name];
    return (await database.query(sql,values(args))).rows[0].result;
   });
   res.writeHead(200,{'Content-Type':'application/json'});
   res.end(JSON.stringify(result));
   return;
  }
  if(url.pathname==='/assets/assessment/api.mjs'){
   res.writeHead(200,{'Content-Type':'text/javascript'});
   res.end(api);
   return;
  }
  if(url.pathname==='/'||url.pathname==='/app/index.html'||url.pathname==='/app/'){
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
   res.end(launch);
   return;
  }
  if(!url.pathname.startsWith('/assets/')&&!isAppView(url.pathname)){
   res.writeHead(303,{Location:'/'});
   res.end();
   return;
  }
  const file=path.resolve(root,'.'+url.pathname);
  if(!file.startsWith(root+path.sep))throw Error('Alamat tidak tersedia.');
  let data=await fs.readFile(file);
  if(isAppView(url.pathname)){
   data=data.toString().replace('</head>',setup+'</head>').replace('<body>','<body>'+banner);
  }
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});
  res.end(data);
 }catch(error){
  res.writeHead(400,{'Content-Type':'application/json'});
  res.end(JSON.stringify({error:error.message}));
 }
});
server.listen(port,'127.0.0.1',()=>console.log('Ruang konsultasi siap: '+origin+'/'));
