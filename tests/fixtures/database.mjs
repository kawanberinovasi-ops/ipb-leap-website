// Disposable in-memory PostgreSQL only. NEVER connects to Supabase.
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
export const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
export const actors={mentee:1,asmen:2,mentor:3,assessor:4,finance:5,system:6,observer:7,stranger:8,manager:9};
export async function createDB(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function auth.uid() returns uuid language sql stable as $$select nullif(auth.jwt()->>'sub','')::uuid$$;
 create function auth.role() returns text language sql stable as $$select auth.jwt()->>'role'$$;
 grant usage on schema auth to anon,authenticated,service_role;grant execute on all functions in schema auth to anon,authenticated,service_role;`);
 for(const file of ['foundation','access','records'])await db.exec(await readFile(new URL('./schema/'+file+'.sql',import.meta.url),'utf8'));
 await db.exec('alter table public.erp_cohorts add column revision int not null default 0;create table erp_private.activations(id uuid primary key);');
 for(const file of ['hardening','subject-scope','record-reference'])await db.exec(await readFile(new URL('./schema/'+file+'.sql',import.meta.url),'utf8'));
 for(const [name,n] of Object.entries(actors)){
 const role=({assessor:'program',observer:'mentee',stranger:'mentor',manager:'program'})[name]||name;
 await db.query('insert into auth.users(id,email,email_confirmed_at)values($1,$2,now())',[id(n),name+'@example.test']);
 await db.query('insert into auth.sessions(id,user_id)values($1,$2)',[id(n+100),id(n)]);
 await db.query('insert into erp_profiles(id,display_name,email,roles,active)values($1,$2,$3,$4,true)',[id(n),name,name+'@example.test',[role]]);
 }
 await db.query("insert into erp_cohorts(id,name,starts_on,ends_on,created_by)values($1,'TEST ONLY','2025-01-01','2026-01-01',$2)",[id(20),id(6)]);
 for(const n of [1,2,3,5])await db.query('insert into erp_enrolments(cohort_id,user_id,role)values($1,$2,$3)',[id(20),id(n),Object.keys(actors).find(k=>actors[k]===n)]);
 await db.query('insert into erp_cohort_staff values($1,$2,false,true),($1,$3,true,false)',[id(20),id(4),id(9)]);
 await db.query("insert into erp_groups(id,cohort_id,name,field,mentor_id,asmen_id,active)values($1,$2,'TEST','test',$3,$4,true)",[id(21),id(20),id(3),id(2)]);
 await db.query('insert into erp_group_members(group_id,user_id)values($1,$2)',[id(21),id(1)]);
 return db;
}
export async function as(db,name,role='authenticated'){
 await db.exec('reset role');
 await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(actors[name]),session_id:id(actors[name]+100),role})]);
 await db.exec('set role '+role);
}
