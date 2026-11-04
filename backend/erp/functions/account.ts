import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
const url=Deno.env.get('SUPABASE_URL')!, key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const service=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const origins=new Set(['https://ipbleap.com','https://www.ipbleap.com','https://kawanberinovasi-ops.github.io','http://127.0.0.1:8767','http://localhost:8767']);
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),x=>x.toString(16).padStart(2,'0')).join('');
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
async function call(action:string,p:unknown,managed=false){const{data,error}=await service.rpc(managed?'erp_managed_account_service':'erp_account_service',{p_action:action,p});if(error)throw Error(error.message);return data;}
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||''; const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':origins.has(origin)?origin:'https://ipbleap.com','Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
 const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:origins.has(origin)?204:403,headers});
 if(req.method!=='POST'||(origin&&!origins.has(origin)))return respond({error:'Permintaan ditolak.'},403);
 try{
  if(Number(req.headers.get('content-length')||0)>12000)throw Error('Isian terlalu panjang.');
  const raw=await req.text();if(raw.length>12000)throw Error('Isian terlalu panjang.');const p=JSON.parse(raw), action=p.action;
  if(['inspect','setup','activate'].includes(action)){
   if(typeof p.token!=='string'||!/^[a-f0-9]{64}$/.test(p.token))throw Error('Buka tautan aktivasi pribadi dari pengelola.');
   const h=await hash(p.token), setup=p.setup===true;
   if(action==='inspect')return respond(await call(setup?'inspect_setup':'inspect_activation',{hash:h}));
   if(typeof p.password!=='string'||p.password.length<10||p.password.length>128)throw Error('Kata sandi harus 10–128 karakter.');
   const isSetup=action==='setup';
   if(isSetup&&(typeof p.name!=='string'||p.name.trim().length<2||p.name.length>120))throw Error('Isi nama pengelola.');
   const reserved=await call(isSetup?'reserve_setup':'reserve_activation',{hash:h});
   let id=reserved.user;
   if(isSetup&&id){const{error}=await service.auth.admin.updateUserById(id,{password:p.password,email_confirm:true,user_metadata:{full_name:p.name.trim()}});if(error)throw Error('Aktivasi belum berhasil. Coba lagi.');}
   else if(isSetup){
    const{data,error}=await service.auth.admin.createUser({email:reserved.email,password:p.password,email_confirm:true,user_metadata:{full_name:p.name.trim()}});
    if(error)throw Error('Akun belum dapat diaktifkan. Hubungi pengelola untuk memulihkan aktivasi.');id=data.user.id;
   }else{const{error}=await service.auth.admin.updateUserById(id,{password:p.password,email_confirm:true});if(error)throw Error('Kata sandi belum berhasil disimpan. Coba aktivasi kembali.');}
   await call(isSetup?'finish_setup':'finish_activation',{hash:h,lease:reserved.lease,user:id,name:p.name});
   return respond({ok:true,email:reserved.email});
  }
  if(!['create','reissue'].includes(action))throw Error('Permintaan akun tidak dikenali.');
  const authorization=req.headers.get('authorization')||'';if(!/^Bearer /i.test(authorization))return respond({error:'Masuk sebagai Super Admin terlebih dahulu.'},401);
  const token=authorization.slice(7);const{data:verified,error}=await service.auth.getUser(token);if(error||!verified.user)return respond({error:'Sesi akun berakhir.'},401);
  const userClient=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
  const{data:me,error:sessionError}=await userClient.rpc('erp_bootstrap');if(sessionError)throw Error('Sesi akun tidak sah.');
  const managed=!!p.cohort,passwordLogin=action==='create'&&p.initial_password!==undefined;
  if(passwordLogin&&(!managed||typeof p.initial_password!=='string'||p.initial_password.length<12||p.initial_password.length>128))throw Error('Password awal harus 12–128 karakter pada pendaftaran cohort.');
  const trusted={actor:verified.user.id,session:me.sessionId,...(managed?{cohort:p.cohort,roles:p.roles,operation:action,user:p.user,expected:p.expected,field:p.field,pathway:p.pathway,password_login:passwordLogin,division:p.division}:{})};await call('authorize',trusted,managed);
  const activation=random(), activationHash=await hash(activation);let id=p.user;
  if(action==='create'){
   if(typeof p.email!=='string'||!/^\S+@\S+\.\S+$/.test(p.email)||p.email.length>254||typeof p.name!=='string'||p.name.trim().length<2||!Array.isArray(p.roles)||!p.roles.length||p.roles.some((r:string)=>!['mentee','asmen','mentor','program','finance','system','event'].includes(r)))throw Error('Lengkapi nama, email, dan peran akun.');
   const{data,error}=await service.auth.admin.createUser({email:p.email.trim().toLowerCase(),email_confirm:true,user_metadata:{full_name:p.name.trim()},...(passwordLogin?{password:p.initial_password}:{})});
   if(error)throw Error('Akun belum dapat dibuat. Periksa email atau gunakan aktivasi ulang untuk akun yang sudah ada.');
   id=data.user.id;
   try{await call('provision',{...trusted,user:id,email:data.user.email,name:p.name.trim(),roles:p.roles,hash:activationHash},managed);}catch(e){await service.auth.admin.deleteUser(id);throw e;}
  }else await call('reissue',{...trusted,user:id,hash:activationHash},managed);
  if(passwordLogin)return respond({ok:true,id,mustChangePassword:true});
  const base=origin==='https://kawanberinovasi-ops.github.io'?'https://kawanberinovasi-ops.github.io/ipb-leap-website/app/index.html':(origins.has(origin)?origin:'https://ipbleap.com')+'/app/index.html';
  return respond({ok:true,id,url:base+'#activate='+activation,expiresDays:14});
 }catch(e){return respond({error:e instanceof Error?e.message:'Permintaan belum berhasil.'},400);}
});

