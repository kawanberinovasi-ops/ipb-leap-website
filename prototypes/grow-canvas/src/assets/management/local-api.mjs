// Copied over assessment/api.mjs ONLY in the isolated local preview by build_local_management.py.
// No Supabase client, live RPC, email, password or network request is used here.
import {localStore,localActor,ACTOR_KEY} from '../management/store.mjs';
export const configured=true;
export const appBase=new URL('../../app/',import.meta.url);
export const errorText=e=>e?.message||'Data lokal belum tersimpan.';
export const bootstrap=async()=>localActor();
export const verifiedUser=async()=>localActor();
export const workspace=async(c=null,m=null)=>localStore().workspace(c,m,localActor());
export const revision=async()=>localStore().read().revision;
export const recordCommand=async p=>localStore().recordCommand(p,localActor());
export const command=async()=>{throw Error('Pengaturan ini belum tersedia pada versi lokal. Gunakan Kelola Akun & Progres.');};
export const accountCommand=async()=>{throw Error('Aktivasi akun produksi tidak dijalankan pada versi lokal.');};
export const rpc=async name=>{throw Error(name==='erp_360_workspace'?'Could not find erp_360_workspace: pengumpulan 360 belum aktif.':'Layanan produksi tidak dihubungi dalam mode lokal.');};
export const edge=async()=>{throw Error('Layanan produksi tidak dihubungi dalam mode lokal.');};
export const safeNext=value=>{try{const u=new URL(value,location.origin);return u.origin===location.origin&&u.pathname.startsWith(appBase.pathname)?u.pathname+u.search:new URL('kelola-program.html',appBase).pathname;}catch{return new URL('kelola-program.html',appBase).pathname;}};
export const client={auth:{onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>{sessionStorage.removeItem(ACTOR_KEY);sessionStorage.removeItem('ipbleap.ui.role');return{};}}};
