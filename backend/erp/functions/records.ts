import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {buildOperation} from './domain.mjs';
import {sourceSnapshot} from './sources.mjs';
const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!;
const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const origins=new Set(['https://ipbleap.com','https://www.ipbleap.com','https://kawanberinovasi-ops.github.io','http://127.0.0.1:8767','http://localhost:8767']);
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),x=>x.toString(16).padStart(2,'0')).join('');
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'',headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':origins.has(origin)?origin:'https://ipbleap.com','Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
 const respond=(data:unknown,status=200)=>new Response(JSON.stringify(data),{headers,status});
 if(req.method==='OPTIONS')return new Response(null,{status:origins.has(origin)?204:403,headers});
 if(req.method!=='POST'||(origin&&!origins.has(origin)))return respond({error:'Permintaan ditolak.'},403);
 try{
  const authorization=req.headers.get('authorization')||'';if(!/^Bearer /i.test(authorization))return respond({error:'Masuk terlebih dahulu.'},401);
  const user=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  const{data:verified,error:verifyError}=await user.auth.getUser(authorization.slice(7));if(verifyError||!verified.user)return respond({error:'Sesi akun berakhir.'},401);
  const raw=await req.text();if(raw.length>110000)throw Error('Isian terlalu panjang.');const p=JSON.parse(raw);
  if(!/^[0-9a-f-]{36}$/i.test(p.request||'')||!/^[0-9a-f-]{36}$/i.test(p.cohort||'')||!/^[0-9a-f-]{36}$/i.test(p.mentee||''))throw Error('Referensi permintaan tidak sah.');
  const{data:revision,error:rError}=await user.rpc('erp_revision',{p_cohort:p.cohort,p_mentee:p.mentee});if(rError)throw Error(rError.message);
  const{data:w,error:wError}=await user.rpc('erp_workspace',{p_cohort:p.cohort,p_mentee:p.mentee});if(wError)throw Error(wError.message);
  if(!w.actor?.active||w.selectedMentee!==p.mentee)throw Error('Mentee tidak dapat diakses.');
  if(p.expected!==revision)throw Error('Data berubah sejak halaman dibuka. Muat ulang sebelum menyimpan; isianmu belum dikirim.');
  if(p.action==='publish'&&p.data?.sourceSnapshot!==sourceSnapshot(w,Number(p.month)))throw Error('Sumber penilaian berubah. Periksa ulang sumber terbaru; isian tetap tersedia.');
  const operation=buildOperation(w,p);
  if(p.action==='publish')operation.sources.recordSnapshot=JSON.parse(p.data.sourceSnapshot);
  const trusted={actor:verified.user.id,session:w.actor.sessionId,cohort:p.cohort,mentee:p.mentee,revision,cohortRevision:w.cohorts.find((c:{id:string})=>c.id===p.cohort)?.revision,action:p.action,operations:[operation],request:p.request,hash:await hash(raw)};
  const{data:result,error}=await service.rpc('erp_commit_records',{p:trusted});if(error)throw Error(error.message);
  return respond(result);
 }catch(e){return respond({error:e instanceof Error?e.message:'Catatan belum tersimpan.'},400);}
});
