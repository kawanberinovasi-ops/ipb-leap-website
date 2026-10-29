#!/usr/bin/env python3
"""Create public, empty, non-persisting assessment preview under docs/review-penilaian.
Uses the unchanged original Navbar and existing production assets. No Supabase config/SDK.
"""
from pathlib import Path
import re,shutil
ROOT=Path(__file__).resolve().parent.parent
out=ROOT/'docs/review-penilaian'
assets=out/'assets/assessment';app=out/'app'
assets.mkdir(parents=True,exist_ok=True);app.mkdir(parents=True,exist_ok=True)
for name in ['app.css','domain.mjs','sources.mjs','observer.mjs']:
 shutil.copy2(ROOT/'src/assets/assessment'/name,assets/name)
s=(ROOT/'src/assets/assessment/app.mjs').read_text().replace('function render(){','function render(){if(reviewPreview)return renderPreview();').replace("'kelompok-penilaian':'kelompok'","'kelompok-penilaian':'kelompok',observer:'observer'").replace('const p=new URLSearchParams();',"const p=new URLSearchParams({peran:query.get('peran')||'mentee'});")
(assets/'app.mjs').write_text(s+'\n'+(ROOT/'tools/review/content.mjs').read_text())
shutil.copy2(ROOT/'tools/review/api.mjs',assets/'api.mjs')
# Copy only assessment views. Other navigation goes to original main website/modules.
originals=['beranda-mentee','beranda-pengurus','catat-sesi','chat','event','file-manager','index','kalender','kelola-event','kelompok','keuangan','monitoring-progres','pengaturan','pengumuman','proker','super-admin','template']
for name in ['penilaian','poc','abc','progres','raport','observer','kelompok-penilaian']:
 html=(ROOT/f'docs/app/{name}.html').read_text()
 html=re.sub(r'<dc-import name="Navbar"[^>]*>', '<dc-import name="Navbar" role="{{previewNavRole}}" active="{{previewNavActive}}">', html)
 html=html.replace('renderVals(){return {};}',"renderVals(){const q=new URLSearchParams(location.search),r=q.get('peran')||'mentee';return {previewNavRole:r==='program'?'pengurus':r,previewNavActive:['asmen','mentor'].includes(r)?'kelompok':'program'};}")
 html=html.replace('m=>m.mount()','m=>m.mountPreview()').replace('href="../index.html"','href="../../index.html"')
 if name=='observer':html=html.replace('assessment/observer.mjs','assessment/app.mjs')
 for slug in originals:
  html=html.replace("'"+slug+".html'","'../../app/"+slug+".html'").replace('href="'+slug+'.html"','href="../../app/'+slug+'.html"')
 for asset in ['logo-color.png','logo-white.png','favicon.png','leap-runtime.js']:
  html=html.replace('../assets/'+asset,'../../assets/'+asset)
 # Original prototype banner remains original. Assessment-specific warning is inside main content.
 (app/(name+'.html')).write_text(html)
(out/'index.html').write_text('<!doctype html><html lang="id"><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=app/penilaian.html?peran=mentee&amp;period=6"><title>Review Penilaian IPB LEAP</title><a href="app/penilaian.html?peran=mentee&amp;period=6">Buka preview penilaian</a></html>')
print('Built isolated review: docs/review-penilaian (empty forms, no backend writes).')
