import {localActor,ACTOR_KEY,localUUID} from './store.mjs';
if(new URLSearchParams(location.search).get('pengelola')==='1'){sessionStorage.removeItem(ACTOR_KEY);sessionStorage.removeItem('ipbleap.ui.role');}
if(!crypto.randomUUID)Object.defineProperty(crypto,'randomUUID',{value:localUUID});
const actor=localActor(),banner=document.createElement('aside');
banner.style.cssText="display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:8px 16px;padding:10px 16px;background:#EEFFB8;color:#32306F;font:600 12px/1.6 'Plus Jakarta Sans',system-ui;position:relative;z-index:80";
const label=document.createElement('span');label.textContent='MODE LOKAL · '+actor.display_name+' · Data tersimpan di browser ini. Tidak terhubung akun produksi.';
const link=document.createElement('a');link.href=new URL('../../app/kelola-program.html?pengelola=1',import.meta.url).href;link.textContent='Kembali ke pengelola lokal →';link.style.cssText='color:#32306F;font-weight:800';link.onclick=()=>{sessionStorage.removeItem(ACTOR_KEY);sessionStorage.removeItem('ipbleap.ui.role');};banner.append(label,link);document.body.prepend(banner);
const prototype=document.querySelector('[data-local-prototype]');if(prototype)prototype.remove();
