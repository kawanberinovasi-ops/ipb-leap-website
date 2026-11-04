import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';import {TRACKS} from '../src/assets/management/store.mjs';
const read=p=>readFile(new URL('../src/assets/'+p,import.meta.url),'utf8');
async function repository({local=false,roles=['mentee'],search='?mentee=own',verified=true}={}){
 const calls=[];let redirected=null;const actor={id:'own',roles,active:true};const cache={cohorts:[],revision:0,staff:[]};const context=vm.createContext({document:{documentElement:{dataset:{leapLocal:String(local)}}},location:{origin:'https://example.test',pathname:'/app/kehadiran.html',search,replace:u=>redirected=String(u)},URLSearchParams,URL});
 const api={verifiedUser:async()=>verified?{id:'own'}:null,bootstrap:async()=>actor,workspace:async()=>{calls.push('subject');return cache;},rpc:async name=>{calls.push(name);return cache;},appBase:new URL('https://example.test/app/')};
 const make=async(values)=>{const m=new vm.SyntheticModule(Object.keys(values),function(){for(const[k,v]of Object.entries(values))this.setExport(k,v);},{context});await m.link(()=>{});await m.evaluate();return m;};
 const apiModule=await make(api);const s=new vm.SourceTextModule(await read('management/repository.mjs'),{context,importModuleDynamically:()=>{calls.push('api-import');return apiModule;}});await s.link(()=>make({localStore:()=>cache,localActor:()=>actor,ACTOR_KEY:'test-only',TRACKS}));await s.evaluate();return{open:s.namespace.openRepository,calls,redirect:()=>redirected};
}
test('attendance uses its restricted roster endpoint for participants and operators without account metadata access',async()=>{
 const own=await repository();await own.open({management:'attendance'});assert.ok(own.calls.includes('erp_attendance_workspace'));assert.ok(!own.calls.includes('erp_management_workspace'));
 const manager=await repository({roles:['program'],search:'?mentee=someone'});await manager.open({management:'attendance'});assert.ok(manager.calls.includes('erp_attendance_workspace'));assert.ok(!manager.calls.includes('erp_management_workspace'));
});
test('local repository never loads live API, while missing production session goes to canonical login with next',async()=>{
 const local=await repository({local:true});assert.equal((await local.open()).local,true);assert.deepEqual(local.calls,[]);
 const guest=await repository({verified:false});await assert.rejects(guest.open(),/Masuk/);assert.match(guest.redirect(),/^https:\/\/example.test\/app\/index.html\?next=/);
});
