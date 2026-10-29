import { CONFIG } from './config.mjs';
import { createClient } from './vendor-supabase.mjs';

export const configured = CONFIG.ready && /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(CONFIG.url) && CONFIG.publishableKey.startsWith('sb_publishable_');
export const client = configured ? createClient(CONFIG.url, CONFIG.publishableKey, {
  auth: { storageKey: 'ipbleap.auth.v1', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' }
}) : null;

export const appBase = new URL('../../app/', import.meta.url);
export function safeNext(value, origin = location.origin) {
 try {const u=new URL(value||new URL('abc.html',appBase).pathname,origin);
 if(u.origin!==origin||!u.pathname.startsWith(appBase.pathname)||/[\\\x00-\x1f]/.test(value||''))return new URL('abc.html',appBase).pathname;
 for(const k of ['role','realm','view','v'])u.searchParams.delete(k);return u.pathname+u.search;
 }catch{return new URL('abc.html',appBase).pathname;}
}

export function errorText(error) {
  const s = error?.message || '';
  if (/Invalid login credentials/i.test(s)) return 'Email atau kata sandi belum cocok.';
  if (/Email not confirmed/i.test(s)) return 'Verifikasi email terlebih dahulu, lalu masuk kembali.';
  if (/rate.limit|too many|security purposes/i.test(s)) return 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.';
  if (/Failed to fetch|NetworkError|fetch failed/i.test(s)) return 'Layanan belum dapat dihubungi. Periksa koneksi, lalu coba lagi; isian belum disimpan.';
  if (/JWT|session.*expired|not authenticated/i.test(s)) return 'Sesi akun berakhir. Masuk kembali untuk melanjutkan.';
  return s || 'Permintaan belum berhasil. Isian belum disimpan.';
}

export async function verifiedUser() {
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  if (error) return null;
  return data.user || null;
}

export async function rpc(name, args = {}) {
  if (!client) throw new Error('Layanan akun IPB LEAP sedang disiapkan.');
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(errorText(error));
  return data;
}

export const bootstrap = () => rpc('erp_bootstrap');
export const workspace = (cohort = null, mentee = null) => rpc('erp_workspace', { p_cohort: cohort, p_mentee: mentee });
export const command = (action, payload, expected = null) => rpc('erp_command', { p_action: action, p_payload: payload, p_expected: expected });
export async function edge(name, payload) {
 if (!client) throw new Error('Layanan akun sedang disiapkan.');
 const {data,error}=await client.functions.invoke(name,{body:payload});
 if(error){let detail;try{detail=await error.context?.json();}catch{}throw new Error(detail?.error||errorText(error));}
 if(data?.error)throw new Error(data.error);return data;
}
export const revision=(cohort,mentee)=>rpc('erp_revision',{p_cohort:cohort,p_mentee:mentee});
export const recordCommand=p=>edge('erp-records',p);
export const accountCommand=p=>edge('erp-account',p);
