#!/usr/bin/env python3
"""Build a local-only management rehearsal. Never upload this output to GitHub Pages."""
from pathlib import Path
import argparse
import shutil
import re

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--qa', action='store_true', help='Isolated browser test data, separate from the empty user preview')
args = parser.parse_args()
OUT = ROOT / '.local-management'
if args.qa:
    OUT = OUT / 'qa'
shutil.copytree(ROOT / 'docs', OUT, dirs_exist_ok=True)
shutil.copy2(ROOT / 'tools/local_attendance_server.py', OUT / 'jalankan.py')
assets = OUT / 'assets'
shutil.copy2(ROOT / 'src/assets/management/local-api.mjs', assets / 'assessment/api.mjs')
shutil.copy2(ROOT / 'src/assets/management/local-session.mjs', assets / 'assessment/session.mjs')
assessment_app = assets / 'assessment/app.mjs'
assessment_app.write_text(assessment_app.read_text().replace('Penyimpanan melalui layanan IPB LEAP;', 'Penyimpanan lokal di browser ini;'))
for page in (OUT / 'app').glob('*.html'):
    s = page.read_text()
    s = s.replace('<html lang="id">', '<html lang="id" data-leap-local="true">')
    s = s.replace('<body>', '<body>\n<script type="module" src="../assets/management/local-banner.mjs"></script>', 1)
    s = re.sub(r'<div style="position:relative;z-index:70;.*?</div>\n', '', s, count=1)
    page.write_text(s)
redirect = '<!doctype html><html lang="id"><meta charset="utf-8"><title>Pengelolaan lokal · IPB LEAP</title><meta http-equiv="refresh" content="0;url={}"><a href="{}">Buka pengelolaan lokal</a></html>'
(OUT / 'index.html').write_text(redirect.format('app/kelola-program.html', 'app/kelola-program.html'))
(OUT / 'app/index.html').write_text(redirect.format('kelola-program.html?pengelola=1', 'kelola-program.html?pengelola=1'))
# Do not leave production config or SDK copies in a local rehearsal output.
for name in ['config.mjs','vendor-supabase.mjs']:
    (assets / 'assessment' / name).unlink(missing_ok=True)
if args.qa:
    for name in ['store.mjs','app.mjs','local-banner.mjs','local-api.mjs','local-session.mjs']:
        file = assets / 'management' / name
        file.write_text(file.read_text().replace('ipbleap.local.', 'ipbleap.qa.management.').replace('MODE LOKAL', 'QA TERISOLASI'))
    for name in ['api.mjs', 'session.mjs']:
        file = assets / 'assessment' / name
        file.write_text(file.read_text().replace('ipbleap.local.', 'ipbleap.qa.management.'))
print(f'Local-only preview: {OUT}; no production account or database connection.')
