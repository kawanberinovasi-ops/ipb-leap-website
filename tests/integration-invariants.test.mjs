import{test}from'node:test';import assert from'node:assert/strict';import{readFile,readdir}from'node:fs/promises';import{execFileSync}from'node:child_process';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('frontend/backend calculation rules remain byte-identical and 360 never adds a second score',async()=>{
 const [browser,server]=await Promise.all([read('src/assets/assessment/domain.mjs'),read('backend/erp/functions/domain.mjs')]);assert.equal(browser,server);assert.equal(server.includes('observerRefs'),false);
});
test('all existing public pages remain byte-identical and all ERP routes remain available',async()=>{
 const config=JSON.parse(await read('site.config.json'));for(const p of Object.values(config.sections[0].pages)){const original=execFileSync('git',['show','268c72681e65a53015b28ccd0ba064b1b7b303f8:docs/'+p.out],{encoding:'utf8'});assert.equal(await read('docs/'+p.out),original,p.out);}
 const existing=['beranda-mentee','beranda-pengurus','catat-sesi','chat','event','file-manager','kalender','kelola-event','kelompok','keuangan','monitoring-progres','pengaturan','pengumuman','penilaian','proker','super-admin','template'];const files=await readdir(new URL('../docs/app',import.meta.url));for(const name of existing)assert.ok(files.includes(name+'.html'));
});
test('single active assessment entry and deployment assets exclude fixtures',async()=>{
 const page=await read('docs/app/penilaian.html');assert.ok(!page.includes('Mentor belum mengisi. Jika sampai'));assert.ok(!page.includes('Skor kamu (Asmen) × 50%'));assert.ok(page.includes('assessment/app.mjs'));assert.ok(!page.includes('justSent'));
 const assets=await readdir(new URL('../docs/assets/assessment',import.meta.url));assert.ok(!assets.some(f=>/fixture|test|mock/.test(f)));
});
test('shared logout hook preserves original Navbar style, hero and unrelated module content',async()=>{
 const base='268c72681e65a53015b28ccd0ba064b1b7b303f8';
 for(const path of ['src/app/BerandaMentee.dc.html'])assert.equal(await read(path),execFileSync('git',['show',base+':'+path],{encoding:'utf8'}),path);
 const paths=execFileSync('git',['ls-tree','-r','--name-only',base,'docs/app'],{encoding:'utf8'}).trim().split('\n').filter(p=>!['docs/app/penilaian.html','docs/app/kelompok.html','docs/app/index.html'].includes(p));
 const withoutNav=s=>s.replace(' onClick="{{logout}}"','').replace(/<script type="text\/x-dc" data-dc="Navbar"[\s\S]*?<\/script>/g,'');
 for(const path of paths)assert.equal(withoutNav(await read(path)),withoutNav(execFileSync('git',['show',base+':'+path],{encoding:'utf8'})),path);
 const nav=await read('src/app/Navbar.dc.html'),original=execFileSync('git',['show',base+':src/app/Navbar.dc.html'],{encoding:'utf8'});assert.equal(nav.match(/<x-dc>[\s\S]*?<\/x-dc>/)[0].replace(' onClick="{{logout}}"',''),original.match(/<x-dc>[\s\S]*?<\/x-dc>/)[0]);
});
test('review is isolated, empty, cannot save, and excludes Supabase credentials/SDK',async()=>{
 const files=await readdir(new URL('../docs/review-penilaian/assets/assessment/',import.meta.url));assert.ok(!files.includes('config.mjs'));assert.ok(!files.includes('vendor-supabase.mjs'));
 const api=await read('docs/review-penilaian/assets/assessment/api.mjs');assert.ok(!api.includes('fetch('));assert.ok(!api.includes('supabase.co'));assert.ok(!api.includes('sb_publishable_'));
 const app=await read('docs/review-penilaian/assets/assessment/app.mjs');assert.ok(app.includes('mountPreview'));assert.ok(app.includes('b.disabled=true'));assert.ok(app.includes('Semua nilai tetap kosong'));
});
