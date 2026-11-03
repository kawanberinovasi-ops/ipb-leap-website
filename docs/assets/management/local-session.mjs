import {localActor,ACTOR_KEY} from '../management/store.mjs';
if(new URLSearchParams(location.search).get('pengelola')==='1'){sessionStorage.removeItem(ACTOR_KEY);sessionStorage.removeItem('ipbleap.ui.role');}
export async function mountSession(){const actor=localActor();window.leapAccount=actor;sessionStorage.setItem('ipbleap.ui.role',actor.roles[0]);window.dispatchEvent(new CustomEvent('leap:account'));return actor;}
export const loginURL=()=>new URL('../../app/kelola-program.html',import.meta.url).pathname;
export async function signOut(event){event?.preventDefault();sessionStorage.removeItem(ACTOR_KEY);sessionStorage.removeItem('ipbleap.ui.role');location.href=loginURL();}
