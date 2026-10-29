import {client,configured,verifiedUser,safeNext,accountCommand,errorText} from './api.mjs';
export async function mount(){
 const login=document.querySelector('#leap-login'),activation=document.querySelector('#leap-activate'),message=document.querySelector('#auth-message');
 const inform=t=>message.textContent=t;
 const next=safeNext(new URLSearchParams(location.search).get('next'));
 const hash=new URLSearchParams(location.hash.slice(1)),setup=hash.get('setup'),token=setup||hash.get('activate');
 let identity=null,busy=false;
 if(token){history.replaceState(null,'',location.pathname+location.search);login.hidden=true;activation.hidden=false;
 try{identity=await accountCommand({action:'inspect',token,setup:!!setup});document.querySelector('#activation-identity').textContent='Aktifkan akun '+identity.email;document.querySelector('#setup-name').hidden=!setup;}
 catch(e){inform(errorText(e));activation.querySelector('button').disabled=true;return;}}
 if(!configured){inform('Layanan akun belum dikonfigurasi.');return;}
 if(!token&&await verifiedUser()){location.replace(next);return;}
 for(const form of [login,activation])form.addEventListener('submit',async e=>{
 e.preventDefault();if(busy||!form.reportValidity())return;const f=new FormData(form);busy=true;form.querySelector('button').disabled=true;inform('Memverifikasi akun…');
 try{let email=String(f.get('email')||'').trim();const password=String(f.get('password')||'');
 if(form===activation){if(!identity)throw Error('Buka tautan aktivasi dari pengelola.');if(password!==f.get('confirm'))throw Error('Ulangi kata sandi yang sama.');const result=await accountCommand({action:setup?'setup':'activate',token,password,name:String(f.get('name')||'').trim()});email=result.email;}
 const{error}=await client.auth.signInWithPassword({email,password});if(error)throw error;if(!await verifiedUser())throw Error('Sesi belum dapat diverifikasi.');form.reset();location.replace(next);
 }catch(err){inform(errorText(err));}finally{busy=false;form.querySelector('button').disabled=false;}});
}
