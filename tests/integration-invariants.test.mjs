import{test}from'node:test';import assert from'node:assert/strict';import{readFile,readdir}from'node:fs/promises';import{execFileSync}from'node:child_process';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('frontend/backend calculation rules remain byte-identical and 360 never adds a second score',async()=>{
 const [browser,server]=await Promise.all([read('src/assets/assessment/domain.mjs'),read('backend/erp/functions/domain.mjs')]);assert.equal(browser,server);assert.equal(server.includes('observerRefs'),false);
});
test('public page content outside the shared navigation is preserved and ERP routes remain available',async()=>{
 const baseline='46f740703bcc629971cf33d14c4b42d4038cafb1';
 const removePublicChrome=html=>html
   .replace(/\nbody\{margin:0\}\n\.leap-public-toggle[\s\S]*?(?=\n\n)/,'\nbody{margin:0}')
   .replace(/<template data-dc="(?:PubNav|PubFooter)">[\s\S]*?<\/template>/g,'')
   .replace(/<script type="text\/x-dc" data-dc="(?:PubNav|PubFooter)"[\s\S]*?<\/script>/g,'');
 const config=JSON.parse(await read('site.config.json'));
 for(const {out} of Object.values(config.sections[0].pages)){
   if(['index.html','asmen.html','mentee-profil.html'].includes(out))continue;
   const original=execFileSync('git',['show',baseline+':docs/'+out],{encoding:'utf8'});
   assert.equal(removePublicChrome(await read('docs/'+out)),removePublicChrome(original),out);
 }
 const home=await read('docs/index.html');
 const asmen=await read('docs/asmen.html');
 const portraits=[...new Set(asmen.match(/assets\/photos\/asmen\/[\w-]+\.webp/g))];
 assert.ok(portraits.length>0);
 assert.doesNotMatch(asmen,/Filter pathway|Nama Asmen|Fakultas · Angkatan/);
 for(const photo of portraits){
   assert.ok((await readFile(new URL('../docs/'+photo,import.meta.url))).length,photo);
   assert.ok(!home.includes(photo),photo);
 }
 assert.doesNotMatch(home,/href="(?:showcase|prestasi|event)\.html"/);
 assert.match(home,/class="leap-public-toggle"[^>]+aria-controls="leap-public-menu"/);
 for(const out of ['tentang.html','mentor.html','asmen.html','mentee.html','kegiatan.html'])assert.ok(home.includes(out),out);
 for(const out of ['tentang.html','kegiatan.html']){
   const actual=await read('docs/'+out);assert.ok(!actual.includes('/_blob/'),out);
   for(const photo of new Set(actual.match(/assets\/photos\/[\w.-]+\.(?:jpg|JPG)/g)))assert.ok((await readFile(new URL('../docs/'+photo,import.meta.url))).length,photo);
 }
 const existing=['beranda-mentee','beranda-pengurus','catat-sesi','chat','event','file-manager','kalender','kelola-event','kelompok','keuangan','monitoring-progres','pengaturan','pengumuman','penilaian','proker','super-admin','template'];const files=await readdir(new URL('../docs/app',import.meta.url));for(const name of existing)assert.ok(files.includes(name+'.html'));
});
test('single active assessment entry and deployment assets exclude fixtures',async()=>{
 const page=await read('docs/app/penilaian.html');assert.ok(!page.includes('Mentor belum mengisi. Jika sampai'));assert.ok(!page.includes('Skor kamu (Asmen) × 50%'));assert.ok(page.includes('assessment/app.mjs'));assert.ok(!page.includes('justSent'));
 const assets=await readdir(new URL('../docs/assets/assessment',import.meta.url));assert.ok(!assets.some(f=>/fixture|test|mock/.test(f)));
});
test('shared logout hook preserves original Navbar style, hero and unrelated module content',async()=>{
 const base='268c72681e65a53015b28ccd0ba064b1b7b303f8';
 const hero=await read('src/app/BerandaMentee.dc.html');assert.ok(hero.includes('Halo, {{displayName}}.'));assert.ok(hero.includes('linear-gradient(180deg, #FFFFFF 0%, #F8FAFF 100%)'));
 const paths=execFileSync('git',['ls-tree','-r','--name-only',base,'docs/app'],{encoding:'utf8'}).trim().split('\n').filter(p=>!['docs/app/catat-sesi.html','docs/app/monitoring-progres.html','docs/app/penilaian.html','docs/app/kelompok.html','docs/app/index.html','docs/app/beranda-mentee.html','docs/app/pengaturan.html','docs/app/event.html','docs/app/kalender.html','docs/app/pengumuman.html'].includes(p));
 const withoutMobile=s=>s.replace(' class="leap-erp-header"','').replace('<link rel="stylesheet" href="../assets/navigation/mobile.css?v=20261105">\n','').replace(', viewport-fit=cover','');
 const withoutRevisedControls=s=>s
  .replace(/^      <button type="button" style="height: 32px;[^\n]*>Batch 2026[\s\S]*?^      <\/button>/m,'      Batch 2026')
  .replace(/^      <span class="leap-batch-label"[^\n]*<\/span>/m,'      Batch 2026')
  .replace(/      <button type="button" aria-label="Tambah cepat"[\s\S]*?^      <\/button>\n/m,'')
  .replace(/^      <button type="button" onClick="{{toggleNotif}}"[\s\S]*?^      <\/button>\n/m,'')
  .replace(/^      <sc-if value="{{notifOpen}}"[\s\S]*?^      <\/sc-if>\n/m,'');
 const withoutNav=s=>withoutRevisedControls(withoutMobile(s)).replace('?v=20261103-portal2','').replace(/<div style="position:relative;z-index:70;[\s\S]*?<\/div>\n/,'').replace(' data-leap-search','').replace(' onClick="{{logout}}"','').replace(' hidden data-hidden-feature="chat"','').replace('display:none!important;','').replace(/<script type="text\/x-dc" data-dc="Navbar"[\s\S]*?<\/script>/g,'');
 for(const path of paths)assert.equal(withoutNav(await read(path)),withoutNav(execFileSync('git',['show',base+':'+path],{encoding:'utf8'})),path);
 const nav=await read('src/app/Navbar.dc.html'),original=execFileSync('git',['show',base+':src/app/Navbar.dc.html'],{encoding:'utf8'});assert.ok(!nav.includes('aria-label="Tambah cepat"'));assert.ok(!nav.includes('Periode penilaian Oktober'));assert.equal(withoutRevisedControls(withoutMobile(nav)).match(/<x-dc>[\s\S]*?<\/x-dc>/)[0].replace(' data-leap-search','').replace(' onClick="{{logout}}"','').replace(' hidden data-hidden-feature="chat"','').replace('display:none!important;',''),withoutRevisedControls(original).match(/<x-dc>[\s\S]*?<\/x-dc>/)[0]);
});
test('review is isolated, empty, cannot save, and excludes Supabase credentials/SDK',async()=>{
 const files=await readdir(new URL('../docs/review-penilaian/assets/assessment/',import.meta.url));assert.ok(!files.includes('config.mjs'));assert.ok(!files.includes('vendor-supabase.mjs'));
 const api=await read('docs/review-penilaian/assets/assessment/api.mjs');assert.ok(!api.includes('fetch('));assert.ok(!api.includes('supabase.co'));assert.ok(!api.includes('sb_publishable_'));
 const app=await read('docs/review-penilaian/assets/assessment/app.mjs');assert.ok(app.includes('mountPreview'));assert.ok(app.includes('b.disabled=true'));assert.ok(app.includes('Semua nilai tetap kosong'));
});
