// One identity and existing Supabase session shared across every LMS module.
import {client,configured,verifiedUser,bootstrap,appBase,errorText} from './api.mjs';
let pending=null,subscription=null;
export function loginURL(next=location.pathname+location.search){return new URL('index.html',appBase).pathname+'?next='+encodeURIComponent(next);}
function clearIdentity(){delete window.leapAccount;delete window.leapContext;sessionStorage.removeItem('ipbleap.ui.role');window.dispatchEvent(new CustomEvent('leap:account'));}
export async function signOut(event){event?.preventDefault();const {error}=await client.auth.signOut({scope:'local'});if(error)throw Error(errorText(error));clearIdentity();location.replace(new URL('index.html',appBase).pathname);}
function showFailure(error){let box=document.querySelector('#shared-session-error');if(!box){box=document.createElement('section');box.id='shared-session-error';box.setAttribute('role','alert');box.style.cssText='position:relative;z-index:100;padding:16px;background:#fff3e3;color:#704600;font:14px system-ui';document.body.prepend(box);}box.replaceChildren(document.createTextNode('Akun belum dapat diperiksa: '+errorText(error)+' '));const retry=document.createElement('button');retry.textContent='Coba lagi';retry.onclick=()=>location.reload();box.append(retry);}
export function mountSession(){
 if(pending)return pending;
 pending=(async()=>{if(!configured)throw Error('Layanan akun belum dikonfigurasi.');if(!await verifiedUser()){location.replace(loginURL());return null;}const actor=await bootstrap();if(!actor.active||!actor.roles?.length)throw Error('Akun belum aktif atau belum memiliki penugasan. Hubungi pengelola.');window.leapAccount=actor;const q=new URLSearchParams(location.search);window.leapContext=Object.fromEntries(['cohort','mentee','group','period','source'].filter(k=>q.has(k)).map(k=>[k,q.get(k)]));window.dispatchEvent(new CustomEvent('leap:account'));
 if(!subscription)subscription=client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){clearIdentity();location.replace(loginURL());}}).data.subscription;
 return actor;})().catch(e=>{showFailure(e);return null;});return pending;
}
