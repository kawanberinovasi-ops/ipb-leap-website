import {client,configured,verifiedUser,safeNext,bootstrap,appBase,accountCommand,errorText} from './api.mjs';
export async function mount(){
 const login=document.querySelector('#leap-login'),activation=document.querySelector('#leap-activate'),message=document.querySelector('#auth-message');
 const inform=t=>message.textContent=t;
 const requested=new URLSearchParams(location.search).get('next');
 const destination=async()=>{const actor=await bootstrap();if(!actor.active)throw Error('Akun belum diaktifkan pengelola.');const roles=actor.roles||[];if(!roles.length)throw Error('Akun belum mendapat penugasan peran. Hubungi pengelola.');const selected=sessionStorage.getItem('ipbleap.ui.role'),role=roles.includes(selected)?selected:roles[0];sessionStorage.setItem('ipbleap.ui.role',role);const home={mentee:'beranda-mentee.html',asmen:'kelompok.html',mentor:'kelompok.html',program:'beranda-pengurus.html',finance:'beranda-pengurus.html',system:'super-admin.html'}[role]||'beranda-mentee.html';return safeNext(requested||new URL(home,appBase).pathname);};
 const hash=new URLSearchParams(location.hash.slice(1)),setup=hash.get('setup'),token=setup||hash.get('activate');
 let identity=null,busy=false;
 if(token){history.replaceState(null,'',location.pathname+location.search);login.hidden=true;activation.hidden=false;
 try{identity=await accountCommand({action:'inspect',token,setup:!!setup});document.querySelector('#activation-identity').textContent='Aktifkan akun '+identity.email;document.querySelector('#setup-name').hidden=!setup;}
 catch(e){inform(errorText(e));activation.querySelector('button').disabled=true;return;}}
 if(!configured){inform('Layanan akun belum dikonfigurasi.');return;}
 if(!token){try{if(await verifiedUser()){location.replace(await destination());return;}}catch(e){inform(errorText(e));}}
 for(const form of [login,activation])form.addEventListener('submit',async e=>{
 e.preventDefault();if(busy||!form.reportValidity())return;const f=new FormData(form);busy=true;form.querySelector('button').disabled=true;inform('Memverifikasi akun…');
 try{let email=String(f.get('email')||'').trim();const password=String(f.get('password')||'');
 if(form===activation){if(!identity)throw Error('Buka tautan aktivasi dari pengelola.');if(password!==f.get('confirm'))throw Error('Ulangi kata sandi yang sama.');const result=await accountCommand({action:setup?'setup':'activate',token,password,name:String(f.get('name')||'').trim()});email=result.email;}
 const{error}=await client.auth.signInWithPassword({email,password});if(error)throw error;if(!await verifiedUser())throw Error('Sesi belum dapat diverifikasi.');form.reset();location.replace(await destination());
 }catch(err){inform(errorText(err));}finally{busy=false;form.querySelector('button').disabled=false;}});
}
