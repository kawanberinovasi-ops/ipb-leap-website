import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDB,as,id} from './fixtures/database.mjs';
test('initial password registration gates every ERP role until an Auth password change and fresh session',async t=>{
 const db=await createDB();t.after(()=>db.close());
 await db.exec(`alter table auth.users add column encrypted_password text;alter table auth.sessions add column created_at timestamptz default now();
 alter table erp_private.activations add column user_id uuid,add column token_hash text,add column expires_at timestamptz,add column used_at timestamptz,add column created_by uuid;alter table erp_private.activations alter column id set default gen_random_uuid();
 create or replace function erp_private.ensure_profile() returns jsonb language plpgsql security definer set search_path='' as $$declare p public.erp_profiles;begin
 if not erp_private.session_valid() then raise exception 'Sesi akun belum terverifikasi.';end if;
 select * into p from public.erp_profiles where id=auth.uid();return to_jsonb(p);end$$;
 create or replace function public.erp_bootstrap() returns jsonb language sql as $$select erp_private.ensure_profile()$$;
 grant execute on function erp_private.ensure_profile(),public.erp_bootstrap() to authenticated;`);
 for(const file of ['management-attendance','managed-accounts','enrolment-pathway-optional','initial-password'])await db.exec(await readFile(new URL('../backend/erp/integrations/'+file+'.sql',import.meta.url),'utf8'));
 const user=id(500),session=id(600),p={actor:id(9),session:id(109),cohort:id(20),operation:'create',roles:['mentee'],field:'Academic & Research',pathway:'',expected:0,user,email:'test@example.test',name:'TEST PARTICIPANT',password_login:true};
 await db.query("insert into auth.users(id,email,email_confirmed_at,encrypted_password)values($1,$2,now(),'TEST HASH INITIAL')",[user,p.email]);await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[session,user]);
 await as(db,'manager','service_role');const call=(action,payload)=>db.query('select erp_managed_account_service($1,$2::jsonb)',[action,JSON.stringify(payload)]);
 await assert.rejects(call('authorize',{...p,roles:['mentor']}),/Mentee dan Asmen/);await call('authorize',p);await call('provision',p);
 await assert.rejects(call('reissue',{...p,operation:'reissue',password_login:false}),/password awal/);
 await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from erp_private.activations')).rows[0].n,0);
 const become=async sid=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:user,session_id:sid,role:'authenticated'})]);await db.exec('set role authenticated');};
 await become(session);assert.equal((await db.query('select erp_bootstrap() p')).rows[0].p.mustChangePassword,true);assert.deepEqual((await db.query('select erp_bootstrap() p')).rows[0].p.roles,[]);
 assert.equal((await db.query('select erp_private.session_valid() valid')).rows[0].valid,false);assert.equal((await db.query('select * from erp_profiles')).rows.length,0);await assert.rejects(db.query('select * from erp_private.password_setup'),/permission denied/);
 await db.exec('reset role');await db.query("update auth.users set raw_user_meta_data='{"+'"mustChangePassword":false'+"}' where id=$1",[user]);await become(session);assert.equal((await db.query('select erp_bootstrap() p')).rows[0].p.mustChangePassword,true);
 await db.exec('reset role');await db.query("update auth.users set encrypted_password='TEST HASH PERSONAL' where id=$1",[user]);
 assert.equal((await db.query('select active from erp_profiles where id=$1',[user])).rows[0].active,true);await become(session);assert.equal((await db.query('select erp_private.session_valid() valid')).rows[0].valid,false);await assert.rejects(db.query('select erp_bootstrap()'),/Sesi/);
 await db.exec('reset role');const fresh=id(601);await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[fresh,user]);await become(fresh);assert.equal((await db.query('select erp_private.session_valid() valid')).rows[0].valid,true);const actor=(await db.query('select erp_bootstrap() p')).rows[0].p;assert.equal(actor.active,true);assert.deepEqual(actor.roles,['mentee']);assert.equal(actor.mustChangePassword,undefined);
});
