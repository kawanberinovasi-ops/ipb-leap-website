#!/usr/bin/env python3
"""Build situs statis IPB LEAP dari file desain src/*.dc.html -> docs/*.html.

Pemakaian:  python3 tools/build.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'src'
DIST = ROOT / 'docs'
CONFIG = json.loads((ROOT / 'site.config.json').read_text(encoding='utf-8'))

PAGES = CONFIG['pages']            # {"PubHome": {"out": "index.html", "title": ..., "desc": ...}}
COMPONENTS = CONFIG['components']  # ["PubNav", "PubFooter"]
ASSETS = CONFIG['assets']          # {"/_blob/<id>": "assets/logo.png"}
LINKS = dict(CONFIG.get('links', {}))  # {"Main.dc.html": "https://..."}
for name, meta in PAGES.items():
    LINKS[name + '.dc.html'] = meta['out']


def parse(name):
    raw = (SRC / f'{name}.dc.html').read_text(encoding='utf-8')
    m = re.search(r'<x-dc>(.*)</x-dc>', raw, re.S)
    if not m:
        sys.exit(f'{name}: tag <x-dc> tidak ditemukan')
    body = m.group(1)
    helmet = ''
    hm = re.search(r'<helmet>(.*?)</helmet>', body, re.S)
    if hm:
        helmet = hm.group(1)
        body = body[:hm.start()] + body[hm.end():]
    sm = re.search(r"<script type=\"text/x-dc\"[^>]*?(?:data-props='([^']*)')?[^>]*>(.*?)</script>", raw, re.S)
    props, script = ('{}', '')
    if sm:
        props = sm.group(1) or '{}'
        script = sm.group(2)
    title = re.search(r'<title>(.*?)</title>', raw, re.S)
    return {
        'body': rewrite(body.strip()),
        'helmet': helmet.strip(),
        'props': props,
        'script': rewrite(script),
        'title': title.group(1).strip() if title else 'IPB LEAP',
    }


def rewrite(text):
    for src, dst in ASSETS.items():
        text = text.replace(src, dst)

    def repl(m):
        target, frag = m.group(1), m.group(2) or ''
        return LINKS.get(target, target) + frag
    return re.sub(r'([A-Za-z0-9_]+\.dc\.html)(#[\w-]+)?', repl, text)


def split_helmet(helmet):
    links = re.findall(r'<link[^>]+>', helmet)
    styles = re.findall(r'<style>(.*?)</style>', helmet, re.S)
    return links, styles


def build_page(name, meta, comps):
    page = parse(name)
    links, styles = split_helmet(page['helmet'])
    for c in comps.values():
        l2, s2 = split_helmet(c['helmet'])
        links += l2
        styles += s2
    seen, uniq_links = set(), []
    for l in links:
        key = re.sub(r'\s+', ' ', l)
        if key not in seen:
            seen.add(key)
            uniq_links.append(l)
    title = meta.get('title') or page['title']
    desc = meta.get('desc', CONFIG['site']['description'])
    url = CONFIG['site']['url'].rstrip('/') + '/' + ('' if meta['out'] == 'index.html' else meta['out'])
    templates = [f'<template data-dc="{name}">\n{page["body"]}\n</template>']
    scripts = [f"<script type=\"text/x-dc\" data-dc=\"{name}\" data-props='{page['props']}'>{page['script']}</script>"]
    for cname, c in comps.items():
        templates.append(f'<template data-dc="{cname}">\n{c["body"]}\n</template>')
        scripts.append(f"<script type=\"text/x-dc\" data-dc=\"{cname}\" data-props='{c['props']}'>{c['script']}</script>")
    html = f'''<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:type" content="website">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{CONFIG['site']['url'].rstrip('/')}/assets/logo-color.png">
<meta name="theme-color" content="#32306F">
<link rel="icon" type="image/png" href="assets/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
{chr(10).join(uniq_links)}
<style>
[data-dc-host]{{display:contents}}
html{{scroll-behavior:smooth}}
{chr(10).join(styles)}
</style>
</head>
<body>
<noscript><p style="padding:24px;font-family:sans-serif">Aktifkan JavaScript untuk melihat website IPB LEAP.</p></noscript>
<div id="app" data-page="{name}"></div>
{chr(10).join(templates)}
{chr(10).join(scripts)}
<script src="assets/leap-runtime.js"></script>
</body>
</html>
'''
    (DIST / meta['out']).write_text(html, encoding='utf-8')
    return meta['out']


def main():
    DIST.mkdir(exist_ok=True)
    comps = {c: parse(c) for c in COMPONENTS}
    out = [build_page(n, m, comps) for n, m in PAGES.items()]
    # 404 sederhana mengarah ke beranda
    (DIST / '404.html').write_text((DIST / 'index.html').read_text(encoding='utf-8'), encoding='utf-8')
    if CONFIG['site'].get('cname'):
        (DIST / 'CNAME').write_text(CONFIG['site']['cname'] + '\n', encoding='utf-8')
    (DIST / '.nojekyll').write_text('', encoding='utf-8')
    print('Built:', ', '.join(out))


if __name__ == '__main__':
    main()
