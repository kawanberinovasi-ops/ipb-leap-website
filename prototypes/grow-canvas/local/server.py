#!/usr/bin/env python3
"""Loopback-only preview; no external API clients, credentials, or production writes."""
import argparse
import json
import mimetypes
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from model import Store, Invalid, Conflict, ROOT
from demo import DEMO_DATE, seed_assessment, workspace_store


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'docs'), **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; form-action 'self'")
        super().end_headers()

    def output(self, value, status=200):
        raw = json.dumps(value).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def valid_host(self):
        return self.headers.get('Host') in ('127.0.0.1:' + str(self.server.server_port), 'localhost:' + str(self.server.server_port))

    def do_GET(self):
        if not self.valid_host():
            return self.output({'error': 'Pratinjau hanya tersedia melalui alamat lokal.'}, 403)
        parsed = urlsplit(self.path)
        if parsed.path.startswith('/api/local/'):
            q = parse_qs(parsed.query)
            try:
                if parsed.path != '/api/local/workspace':
                    return self.output({'error': 'Layanan tidak ditemukan.'}, 404)
                store = workspace_store(self.server, q.get('demo', [None])[0])
                return self.output(store.view(q.get('track', ['social'])[0], q.get('role', ['mentee'])[0]))
            except Invalid as error:
                return self.output({'error': str(error)}, 400)
        if parsed.path == '/' or parsed.path.startswith('/preview/erp/'):
            self.send_response(302)
            self.send_header('Location', '/app/grow-canvas.html' + ('?' + parsed.query if parsed.query else ''))
            self.end_headers()
            return
        return super().do_GET()

    def do_POST(self):
        origin = self.headers.get('Origin')
        if not self.valid_host() or (origin and origin not in ('http://127.0.0.1:' + str(self.server.server_port), 'http://localhost:' + str(self.server.server_port))):
            return self.output({'error': 'Permintaan harus berasal dari pratinjau lokal.'}, 403)
        if urlsplit(self.path).path != '/api/local/command':
            return self.output({'error': 'Layanan tidak ditemukan.'}, 404)
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length < 1 or length > 120000 or self.headers.get_content_type() != 'application/json':
                raise Invalid('Format permintaan belum benar.')
            p = json.loads(self.rfile.read(length))
            store = workspace_store(self.server, p.get('demo'))
            return self.output(store.command(p['track'], p['role'], p['action'], p.get('data', {}), p.get('expected')))
        except Conflict as error:
            return self.output({'error': str(error)}, 409)
        except (Invalid, KeyError, TypeError, json.JSONDecodeError, ValueError) as error:
            return self.output({'error': str(error)}, 400)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--database', default=str(ROOT / 'data/grow.sqlite3'))
    parser.add_argument('--demo-database', default=str(ROOT / 'data/assessment-practice.sqlite3'))
    args = parser.parse_args()
    (ROOT / 'data').mkdir(exist_ok=True)
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    server.store = Store(args.database)
    if Path(args.database).resolve() == Path(args.demo_database).resolve():
        raise ValueError('Data latihan harus terpisah dari data isian pengguna.')
    server.demo_store = Store(args.demo_database, DEMO_DATE)
    seed_assessment(server.demo_store)
    mimetypes.add_type('text/javascript', '.mjs')
    print(f'GROW Canvas lokal: http://127.0.0.1:{args.port}/app/grow-canvas.html', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
