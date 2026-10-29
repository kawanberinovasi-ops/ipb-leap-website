#!/usr/bin/env python3
"""Build situs statis IPB LEAP dari file desain src/*.dc.html -> docs/.

- Website publik  : src/Pub*.dc.html      -> docs/*.html
- Management System: src/app/*.dc.html    -> docs/app/*.html  (prototype)

Pemakaian:  python3 tools/build.py
"""
import json
import os
import posixpath
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'src'
DIST = ROOT / 'docs'
CONFIG = json.loads((ROOT / 'site.config.json').read_text(encoding='utf-8'))
SITE_URL = CONFIG['site']['url'].rstrip('/') + '/'

# name -> {"src": Path, "out": "app/chat.html", "title": ..., "desc": ...}
PAGES = {}
for section in CONFIG['sections']:
    for name, meta in section['pages'].items():
        PAGES[name] = dict(meta, src=SRC / section['src'] / f'{name}.dc.html', section=section)
COMPONENTS = {}
for section in CONFIG['sections']:
    for name in section.get('components', []):
        COMPONENTS[name] = SRC / section['src'] / f'{name}.dc.html'

ASSETS = CONFIG['assets']   # "/_blob/<id>" -> "assets/logo.png" (relative to docs/)
EXTRA_LINKS = CONFIG.get('links', {})  # "Foo.dc.html" -> absolute URL or docs-relative path


def rel(target, from_out):
    """Path from the page at docs/<from_out> to docs/<target>."""
    if re.match(r'^(https?:|mailto:|tel:|#)', target):
        return target
    base = posixpath.dirname(from_out)
    return posixpath.relpath(target, base or '.')


def link_for(dc_name, from_out):
    key = dc_name[:-len('.dc.html')]
    if key in PAGES:
        return rel(PAGES[key]['out'], from_out)
    if dc_name in EXTRA_LINKS:
        return rel(EXTRA_LINKS[dc_name], from_out)
    return dc_name


def rewrite(text, from_out):
    for src, dst in ASSETS.items():
        text = text.replace(src, rel(dst, from_out))

    def repl(m):
        return link_for(m.group(1), from_out) + (m.group(2) or '')
    return re.sub(r'([A-Za-z0-9_]+\.dc\.html)(#[\w-]+)?', repl, text)


def parse(path, from_out):
    raw = path.read_text(encoding='utf-8')
    m = re.search(r'<x-dc>(.*)</x-dc>', raw, re.S)
    if not m:
        sys.exit(f'{path.name}: tag <x-dc> tidak ditemukan')
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
        'body': rewrite(body.strip(), from_out),
        'helmet': helmet.strip(),
        'props': props,
        'script': rewrite(script, from_out),
        'title': title.group(1).strip() if title else 'IPB LEAP',
        'imports': sorted(set(re.findall(r'<dc-import[^>]*\bname="([A-Za-z0-9_]+)"', body))),
    }


def split_helmet(helmet):
    return re.findall(r'<link[^>]+>', helmet), re.findall(r'<style>(.*?)</style>', helmet, re.S)


def build_page(name, meta):
    out = meta['out']
    page = parse(meta['src'], out)
    comps, queue = {}, list(page['imports'])
    while queue:
        c = queue.pop(0)
        if c in comps:
            continue
        if c not in COMPONENTS:
            sys.exit(f'{name}: komponen {c} tidak terdaftar di site.config.json')
        comps[c] = parse(COMPONENTS[c], out)
        queue += comps[c]['imports']

    links, styles = split_helmet(page['helmet'])
    for c in comps.values():
        l2, s2 = split_helmet(c['helmet'])
        links += l2
        styles += s2
    seen, uniq = set(), []
    for l in links:
        k = re.sub(r'\s+', ' ', l)
        if k not in seen:
            seen.add(k)
            uniq.append(l)

    section = meta['section']
    title = meta.get('title') or page['title']
    desc = meta.get('desc') or section.get('description') or CONFIG['site']['description']
    url = SITE_URL + ('' if out == 'index.html' else out)
    robots = '<meta name="robots" content="noindex">\n' if section.get('noindex') else ''
    templates = [f'<template data-dc="{name}">\n{page["body"]}\n</template>']
    scripts = [f"<script type=\"text/x-dc\" data-dc=\"{name}\" data-props='{page['props']}'>{page['script']}</script>"]
    for cname, c in comps.items():
        templates.append(f'<template data-dc="{cname}">\n{c["body"]}\n</template>')
        scripts.append(f"<script type=\"text/x-dc\" data-dc=\"{cname}\" data-props='{c['props']}'>{c['script']}</script>")
    banner = section.get('banner', '')
    if banner:
        banner = banner.replace('{home}', rel('index.html', out))
    html = f'''<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
{robots}<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:type" content="website">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{SITE_URL}assets/logo-color.png">
<meta name="theme-color" content="#32306F">
<link rel="icon" type="image/png" href="{rel('assets/favicon.png', out)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
{chr(10).join(uniq)}
<style>
[data-dc-host]{{display:contents}}
html{{scroll-behavior:smooth}}
{chr(10).join(styles)}
</style>
</head>
<body>
<noscript><p style="padding:24px;font-family:sans-serif">Aktifkan JavaScript untuk melihat halaman ini.</p></noscript>
{banner}<div id="app" data-page="{name}"></div>
{chr(10).join(templates)}
{chr(10).join(scripts)}
<script src="{rel('assets/leap-runtime.js', out)}"></script>
</body>
</html>
'''
    dest = DIST / out
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(html, encoding='utf-8')
    return out


def main():
    DIST.mkdir(exist_ok=True)
    out = [build_page(n, m) for n, m in PAGES.items()]
    (DIST / '404.html').write_text((DIST / 'index.html').read_text(encoding='utf-8'), encoding='utf-8')
    if CONFIG['site'].get('cname'):
        (DIST / 'CNAME').write_text(CONFIG['site']['cname'] + '\n', encoding='utf-8')
    elif (DIST / 'CNAME').exists():
        os.remove(DIST / 'CNAME')
    (DIST / '.nojekyll').write_text('', encoding='utf-8')
    print(f'Built {len(out)} halaman:', ', '.join(out))


if __name__ == '__main__':
    main()
