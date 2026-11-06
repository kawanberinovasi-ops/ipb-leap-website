import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDB,as,id} from './fixtures/database.mjs';

test('groups can be planned with empty or pending staff and mentees without activating their login',async t=>{
 const db=await createDB();t.after(()=>db.close());
 await db.exec(`alter table auth.users add column encrypted_password text;alter table auth.sessions add column created_at timestamptz default now();
 alter table erp_private.activations add column user_id uuid,add column token_hash text,add column expires_at timestamptz,add column used_at timestamptz,add column created_by uuid;alter table erp_private.activations alter column id set default gen_random_uuid();
 delete from erp_group_members;delete from erp_groups;`);
 for(const file of ['management-attendance','managed-accounts','enrolment-pathway-optional','initial-password','group-planning','group-live-data'])await db.exec(await readFile(new URL('../backend/erp/integrations/'+file+'.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261106232153_group_roster_management.sql',import.meta.url),'utf8'));
 await db.query("update auth.users set encrypted_password='TEST INITIAL HASH' where id in ($1,$2)",[id(1),id(2)]);
 await db.query('update erp_profiles set active=false where id in ($1,$2)',[id(1),id(2)]);await db.query('insert into erp_private.password_setup(user_id) values($1),($2)',[id(1),id(2)]);
 const field='Entrepreneur / Business';await db.query('update erp_enrolments set field=$1,pathway=$2 where role=$3',[field,'','mentee']);
 await as(db,'manager');const w=(await db.query('select erp_management_workspace($1) w',[id(20)])).rows[0].w;assert.equal(w.profiles.find(p=>p.id===id(2)).pending_activation,true);
 await as(db,'asmen');assert.equal((await db.query('select erp_bootstrap() p')).rows[0].p.mustChangePassword,true);assert.equal((await db.query('select erp_private.session_valid() valid')).rows[0].valid,false);await assert.rejects(db.query('select erp_management_workspace($1)',[id(20)]),/Masuk/);await assert.rejects(db.query('select erp_private.profile_assignable($1)',[id(2)]),/permission denied/);
 const command=async p=>{await as(db,'manager');const rev=(await db.query('select revision from erp_cohorts where id=$1',[id(20)])).rows[0].revision;return db.query('select erp_management_command($1,$2)',[JSON.stringify({cohort:id(20),...p}),rev]);};
 const group={action:'group',id:id(300),name:'TEST PLANNED GROUP',field,mentor_id:'',asmen_id:''};await command(group);
 await db.exec('reset role');assert.equal((await db.query('select active from erp_groups where id=$1',[id(300)])).rows[0].active,false);
 await assert.rejects(db.query('insert into erp_groups(cohort_id,name,field,mentor_id,asmen_id)values($1,$2,$3,$4,$4)',[id(20),'INVALID SAME PERSON',field,id(3)]),/erp_groups_check/);
 await command({...group,mentor_id:id(3),asmen_id:id(2)});
 await assert.rejects(command({...group,id:id(301),name:'DUPLICATE STAFF',asmen_id:id(2)}),/ditugaskan/);
 await assert.rejects(command({...group,asmen_id:id(8)}),/pendamping/);
 await db.exec('reset role');await db.query('update erp_enrolments set active=false where user_id=$1',[id(2)]);await assert.rejects(command({...group,asmen_id:id(2)}),/pendamping/);await db.exec('reset role');await db.query('update erp_enrolments set active=true where user_id=$1',[id(2)]);
 const mentees=[id(1)];
 for(let n=501;n<=505;n++){await db.query("insert into auth.users(id,email,email_confirmed_at,encrypted_password)values($1,$2,now(),'TEST INITIAL HASH')",[id(n),n+'@example.test']);await db.query('insert into erp_profiles(id,email,display_name,roles,active) values($1,$2,$3,$4,false)',[id(n),n+'@example.test','TEST '+n,['mentee']]);await db.query('insert into erp_enrolments(cohort_id,user_id,role,field,pathway)values($1,$2,$3,$4,$5)',[id(20),id(n),'mentee',field,'']);await db.query('insert into erp_private.password_setup(user_id)values($1)',[id(n)]);mentees.push(id(n));}
 for(const user of mentees.slice(0,5)){await db.exec('reset role');const p=(await db.query('select * from erp_profiles where id=$1',[user])).rows[0];await command({action:'account',user,role:'mentee',display_name:p.display_name,email:p.email,field,pathway:'',group_id:group.id,active:true});}
 await assert.rejects(command({action:'account',user:id(505),role:'mentee',display_name:'TEST 505',email:'505@example.test',field,pathway:'',group_id:group.id,active:true}),/maksimal lima/);
 await db.exec('reset role');assert.equal((await db.query('select active from erp_groups where id=$1',[group.id])).rows[0].active,false);
 for(const user of mentees.slice(0,5))await db.query("update auth.users set encrypted_password='TEST PERSONAL HASH' where id=$1",[user]);
 assert.equal((await db.query('select active from erp_groups where id=$1',[group.id])).rows[0].active,false,'pending Asmen keeps group inactive');
 await db.query("update auth.users set encrypted_password='TEST PERSONAL HASH' where id=$1",[id(2)]);assert.equal((await db.query('select active from erp_groups where id=$1',[group.id])).rows[0].active,true,'activation automatically refreshes planned group');
 await as(db,'asmen');assert.equal((await db.query('select erp_private.staff_for($1,$2,$3) yes',[id(20),id(1),'asmen'])).rows[0].yes,false,'old initial-password session stays blocked');
 await db.exec('reset role');await db.query('insert into auth.sessions(id,user_id)values($1,$2)',[id(700),id(2)]);await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(2),session_id:id(700),role:'authenticated'})]);await db.exec('set role authenticated');assert.equal((await db.query('select erp_private.staff_for($1,$2,$3) yes',[id(20),id(1),'asmen'])).rows[0].yes,true);
 await command({action:'account',user:id(2),role:'asmen',display_name:'asmen',email:'asmen@example.test',active:false});await db.exec('reset role');assert.equal((await db.query('select active from erp_groups where id=$1',[group.id])).rows[0].active,false);
 const second={action:'group',id:id(302),name:'TEST SECOND GROUP',field,mentor_id:'',asmen_id:'',mentee_ids:[id(505),id(1)]};
 await assert.rejects(command(second),/kelompok lain/);
 await db.exec('reset role');
 assert.equal((await db.query('select count(*)::int n from erp_groups where id=$1',[second.id])).rows[0].n,0,'roster failure rolls back group creation');
 await assert.rejects(command({...second,mentee_ids:[id(505),id(505)]}),/satu kali/);
 await as(db,'mentor');
 await assert.rejects(db.query("select erp_management_command($1,0)",[JSON.stringify({action:'group_archive',cohort:id(20),id:group.id})]),/ditugaskan/);
 await db.query("select erp_group_session_command('save',$1)",[JSON.stringify({group:group.id,id:id(303),expected:0,status:'Draft',data:{kind:'group',attendance:[{user_id:id(1),status:''}],actions:[]}})]);
 await command({action:'group_archive',id:group.id});
 await db.exec('reset role');
 const archived=(await db.query('select * from erp_groups where id=$1',[group.id])).rows[0];
 assert.ok(archived.archived_at);
 assert.equal(archived.mentor_id,null);
 assert.equal((await db.query('select count(*)::int n from erp_group_members where group_id=$1 and left_at is not null',[group.id])).rows[0].n,5);
 assert.equal((await db.query('select count(*)::int n from erp_group_session_logs where group_id=$1',[group.id])).rows[0].n,1,'group session history survives archive');
 await as(db,'mentor');
 await assert.rejects(db.query("select erp_group_session_command('state',$1)",[JSON.stringify({group:group.id})]),/pendamping/);
 await assert.rejects(command(group),/Kelompok tidak cocok/);
 await command({...second,mentor_id:id(3)});
 await db.exec('reset role');
 assert.deepEqual((await db.query('select user_id from erp_group_members where group_id=$1 and active order by user_id',[second.id])).rows.map(row=>row.user_id),[id(1),id(505)]);
 for(const actor of ['mentee','asmen','mentor','finance','assessor']){await as(db,actor);await assert.rejects(db.query('select erp_management_command($1,0)',[JSON.stringify({...group,cohort:id(20)})]),/ditugaskan|Masuk/);}
});
