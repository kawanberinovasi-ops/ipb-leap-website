#!/usr/bin/env python3
"""Single-operator LOCAL attendance database and static preview; not a production auth server."""
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from http.cookies import SimpleCookie
from pathlib import Path
from urllib.parse import urlsplit
from uuid import UUID, uuid4
from contextlib import contextmanager
import argparse
import json
import os
import secrets
import sqlite3


class Invalid(ValueError):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def identifier(value):
    try:
        return str(UUID(str(value)))
    except (ValueError, TypeError, AttributeError):
        raise Invalid('Referensi data tidak sah.')


def date_time(value):
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if parsed.tzinfo is None:
            raise ValueError()
        return parsed.astimezone(timezone.utc)
    except (ValueError, TypeError, AttributeError):
        raise Invalid('Isi waktu kegiatan beserta zona waktu yang benar.')


def iso_now():
    return datetime.now(timezone.utc).isoformat()


class AttendanceDB:
    def __init__(self, path, now=iso_now):
        self.path, self.now = str(path), now
        with self.connect() as db:
            db.executescript('''
            create table if not exists registries(id text primary key, revision integer not null);
            create table if not exists cohorts(id text primary key, registry_id text not null references registries(id), name text not null);
            create table if not exists profiles(id text primary key, registry_id text not null references registries(id), display_name text not null, role text not null, active integer not null check(active in(0,1)));
            create table if not exists enrolments(cohort_id text references cohorts(id), user_id text references profiles(id), role text not null, active integer not null, primary key(cohort_id,user_id,role));
            create table if not exists cards(user_id text primary key references profiles(id), token text not null unique, created_at text not null);
            create table if not exists attendance_events(id text primary key, registry_id text not null references registries(id), cohort_id text not null references cohorts(id), name text not null, kind text not null check(kind in('Common Class','Mentoring','Event')), starts_at text not null, ends_at text not null, closed integer not null default 0, revision integer not null default 1, created_at text not null);
            create table if not exists participants(event_id text references attendance_events(id), user_id text references profiles(id), primary key(event_id,user_id));
            create table if not exists attendance(id text primary key, event_id text not null references attendance_events(id), user_id text not null references profiles(id), status text not null check(status in('Hadir','Izin','Absen')), method text not null check(method in('qr','manual')), recorded_at text not null, updated_at text not null, operator text not null, revision integer not null default 1, unique(event_id,user_id));
            create table if not exists attendance_history(id text primary key, attendance_id text not null references attendance(id), previous_status text, status text not null, reason text not null, method text not null, operator text not null, created_at text not null);
            create index if not exists attendance_by_user on attendance(user_id,event_id);
            ''')

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute('pragma foreign_keys=on')
        try:
            with db:
                yield db
        finally:
            db.close()

    def registry(self, db, value):
        rid = identifier(value)
        if not db.execute('select 1 from registries where id=?', (rid,)).fetchone():
            raise Invalid('Daftar akun belum disambungkan ke database lokal.')
        return rid

    def sync(self, p):
        rid = identifier(p.get('registry'))
        rev = p.get('revision')
        if not isinstance(rev, int) or isinstance(rev, bool) or rev < 0:
            raise Invalid('Revisi daftar akun tidak sah.')
        for key in ('profiles', 'cohorts', 'enrolments'):
            if not isinstance(p.get(key), list) or len(p[key]) > 5000:
                raise Invalid('Daftar akun lokal belum benar.')
        with self.connect() as db:
            db.execute('begin immediate')
            prior = db.execute('select revision from registries where id=?', (rid,)).fetchone()
            if prior and rev < prior['revision']:
                raise Invalid('Daftar akun berubah. Muat ulang sebelum menyambungkan.', 409)
            db.execute('insert into registries values(?,?) on conflict(id) do update set revision=excluded.revision', (rid, rev))
            for c in p['cohorts']:
                cid = identifier(c.get('id'))
                self.check_owner(db, 'cohorts', cid, rid)
                db.execute('insert into cohorts values(?,?,?) on conflict(id) do update set name=excluded.name', (cid, rid, self.name(c.get('name'))))
            for user in p['profiles']:
                uid = identifier(user.get('id'))
                self.check_owner(db, 'profiles', uid, rid)
                role = user.get('role')
                if role not in ('mentee', 'asmen', 'mentor', 'program', 'finance', 'system'):
                    raise Invalid('Peran akun tidak sah.')
                db.execute('insert into profiles values(?,?,?,?,?) on conflict(id) do update set display_name=excluded.display_name,role=excluded.role,active=excluded.active', (uid, rid, self.name(user.get('display_name')), role, int(user.get('active') is True)))
            for e in p['enrolments']:
                uid, cid = identifier(e.get('user_id')), identifier(e.get('cohort_id'))
                self.check_owner(db, 'profiles', uid, rid, required=True)
                self.check_owner(db, 'cohorts', cid, rid, required=True)
                db.execute('insert into enrolments values(?,?,?,?) on conflict(cohort_id,user_id,role) do update set active=excluded.active', (cid, uid, e.get('role'), int(e.get('active') is True)))
        return {'ok': True, 'database': 'SQLite lokal', 'revision': rev}

    @staticmethod
    def check_owner(db, table, ident, registry, required=False):
        row = db.execute('select registry_id from '+table+' where id=?', (ident,)).fetchone()
        if row and row['registry_id'] != registry or required and not row:
            raise Invalid('Data bukan milik daftar akun lokal ini.', 403)

    @staticmethod
    def name(value):
        if not isinstance(value, str) or not value.strip() or len(value) > 180:
            raise Invalid('Isi nama yang benar (maksimal 180 karakter).')
        return value.strip()

    def active_mentee(self, db, rid, uid, cid=None):
        row = db.execute("select * from profiles where id=? and registry_id=? and role='mentee' and active=1", (uid, rid)).fetchone()
        if not row or cid and not db.execute("select 1 from enrolments where cohort_id=? and user_id=? and role='mentee' and active=1", (cid, uid)).fetchone():
            raise Invalid('Mentee tidak aktif atau tidak terdaftar pada cohort kegiatan.', 403)
        return row

    def card(self, p):
        uid = identifier(p.get('mentee'))
        with self.connect() as db:
            rid = self.registry(db, p.get('registry'))
            self.active_mentee(db, rid, uid)
            db.execute('insert into cards values(?,?,?) on conflict(user_id) do nothing', (uid, secrets.token_urlsafe(32), self.now()))
            card = db.execute('select token from cards where user_id=?', (uid,)).fetchone()
        return {'ok': True, 'mentee': uid, 'payload': 'ipbleap:attendance:v1:'+card['token']}

    def event(self, p):
        eid, cid = identifier(p.get('id')), identifier(p.get('cohort'))
        start, end = date_time(p.get('starts_at')), date_time(p.get('ends_at'))
        if end <= start:
            raise Invalid('Waktu selesai harus setelah waktu mulai.')
        kind = p.get('kind')
        if kind not in ('Common Class', 'Mentoring', 'Event'):
            raise Invalid('Pilih jenis kegiatan.')
        ids = list(dict.fromkeys(identifier(v) for v in p.get('participants', [])))
        if not ids or len(ids) > 5000:
            raise Invalid('Pilih setidaknya satu mentee peserta kegiatan.')
        with self.connect() as db:
            db.execute('begin immediate')
            rid = self.registry(db, p.get('registry'))
            self.check_owner(db, 'cohorts', cid, rid, required=True)
            old = db.execute('select * from attendance_events where id=?', (eid,)).fetchone()
            if old:
                if old['registry_id'] != rid:
                    raise Invalid('Kegiatan tidak dapat diakses.', 403)
                previous_ids = {r['user_id'] for r in db.execute('select user_id from participants where event_id=?', (eid,))}
                if any((old['cohort_id'] != cid, old['name'] != self.name(p.get('name')), old['kind'] != kind, old['starts_at'] != start.isoformat(), old['ends_at'] != end.isoformat(), previous_ids != set(ids))):
                    raise Invalid('Kegiatan dengan ID ini sudah tersimpan dengan isian berbeda. Muat ulang daftar; isian tetap tersedia.', 409)
                return {'ok': True, 'id': eid, 'duplicate': True}
            for uid in ids:
                self.active_mentee(db, rid, uid, cid)
            db.execute('insert into attendance_events(id,registry_id,cohort_id,name,kind,starts_at,ends_at,created_at) values(?,?,?,?,?,?,?,?)', (eid, rid, cid, self.name(p.get('name')), kind, start.isoformat(), end.isoformat(), self.now()))
            db.executemany('insert into participants values(?,?)', [(eid, uid) for uid in ids])
        return {'ok': True, 'id': eid}

    def get_event(self, db, p):
        rid = self.registry(db, p.get('registry'))
        row = db.execute('select * from attendance_events where id=? and registry_id=?', (identifier(p.get('event')), rid)).fetchone()
        if not row:
            raise Invalid('Kegiatan tidak ditemukan.', 404)
        return row

    def scan(self, p):
        payload = p.get('payload', '')
        if not isinstance(payload, str) or not payload.startswith('ipbleap:attendance:v1:') or len(payload) > 160:
            raise Invalid('QR bukan kartu presensi IPB LEAP yang valid.')
        with self.connect() as db:
            db.execute('begin immediate')
            event = self.get_event(db, p)
            card = db.execute('select user_id from cards where token=?', (payload.removeprefix('ipbleap:attendance:v1:'),)).fetchone()
            if not card:
                raise Invalid('Kartu tidak dikenal. Gunakan QR presensi dari data lokal ini.')
            uid = card['user_id']
            user = self.active_mentee(db, event['registry_id'], uid, event['cohort_id'])
            if not db.execute('select 1 from participants where event_id=? and user_id=?', (event['id'], uid)).fetchone():
                raise Invalid('Mentee bukan peserta kegiatan ini.', 403)
            now = self.now()
            if event['closed'] or not date_time(event['starts_at']) <= date_time(now) <= date_time(event['ends_at']):
                raise Invalid('Presensi belum dibuka atau sudah ditutup.', 409)
            old = db.execute('select * from attendance where event_id=? and user_id=?', (event['id'], uid)).fetchone()
            if old:
                if old['status'] != 'Hadir':
                    raise Invalid('Sudah ada status '+old['status']+'. Gunakan koreksi dengan alasan; scan tidak menimpa status.', 409)
                return {'ok': True, 'duplicate': True, 'name': user['display_name'], 'attendance': dict(old)}
            ident = str(uuid4())
            db.execute("insert into attendance values(?,?,?,'Hadir','qr',?,?,?,1)", (ident, event['id'], uid, now, now, 'Pengurus lokal'))
            self.audit(db, ident, None, 'Hadir', 'Scan QR oleh pengurus', 'qr', now)
            saved = dict(db.execute('select * from attendance where id=?', (ident,)).fetchone())
        return {'ok': True, 'duplicate': False, 'name': user['display_name'], 'attendance': saved}

    @staticmethod
    def audit(db, ident, previous, status, reason, method, now):
        db.execute('insert into attendance_history values(?,?,?,?,?,?,?,?)', (str(uuid4()), ident, previous, status, reason, method, 'Pengurus lokal', now))

    def correct(self, p):
        uid, status = identifier(p.get('mentee')), p.get('status')
        reason = self.name(p.get('reason'))
        if status not in ('Hadir', 'Izin', 'Absen'):
            raise Invalid('Pilih status kehadiran.')
        with self.connect() as db:
            db.execute('begin immediate')
            event = self.get_event(db, p)
            self.active_mentee(db, event['registry_id'], uid, event['cohort_id'])
            if not db.execute('select 1 from participants where event_id=? and user_id=?', (event['id'], uid)).fetchone():
                raise Invalid('Mentee bukan peserta kegiatan ini.', 403)
            old = db.execute('select * from attendance where event_id=? and user_id=?', (event['id'], uid)).fetchone()
            if p.get('expected') != (old['revision'] if old else 0):
                raise Invalid('Kehadiran berubah. Muat ulang sebelum menyimpan; isian belum dikirim.', 409)
            now, ident = self.now(), old['id'] if old else str(uuid4())
            if old:
                db.execute("update attendance set status=?,method='manual',updated_at=?,revision=revision+1,operator='Pengurus lokal' where id=?", (status, now, ident))
            else:
                db.execute("insert into attendance values(?,?,?,?,'manual',?,?,?,1)", (ident, event['id'], uid, status, now, now, 'Pengurus lokal'))
            self.audit(db, ident, old['status'] if old else None, status, reason, 'manual', now)
        return {'ok': True, 'id': ident}

    def close(self, p):
        with self.connect() as db:
            db.execute('begin immediate')
            e = self.get_event(db, p)
            if e['revision'] != p.get('expected'):
                raise Invalid('Kegiatan berubah. Muat ulang sebelum menutup.', 409)
            db.execute('update attendance_events set closed=1,revision=revision+1 where id=?', (e['id'],))
        return {'ok': True}

    def state(self, p):
        with self.connect() as db:
            rid = self.registry(db, p.get('registry'))
            cid = identifier(p.get('cohort'))
            self.check_owner(db, 'cohorts', cid, rid, required=True)
            events = [dict(r) for r in db.execute('select * from attendance_events where cohort_id=? and registry_id=? order by starts_at desc', (cid, rid))]
            participants = [dict(r) for r in db.execute('select a.event_id,a.user_id,p.display_name from participants a join attendance_events e on e.id=a.event_id join profiles p on p.id=a.user_id where e.cohort_id=? and e.registry_id=?', (cid, rid))]
            rows = [dict(r) for r in db.execute('select a.* from attendance a join attendance_events e on e.id=a.event_id where e.cohort_id=? and e.registry_id=?', (cid, rid))]
            history = [dict(r) for r in db.execute('select h.* from attendance_history h join attendance a on a.id=h.attendance_id join attendance_events e on e.id=a.event_id where e.cohort_id=? and e.registry_id=? order by h.created_at', (cid, rid))]
        return {'ok': True, 'database': 'SQLite lokal', 'events': events, 'participants': participants, 'attendance': rows, 'history': history}


def handler_for(database, directory, preview=False):
    class Handler(SimpleHTTPRequestHandler):
        csrf = secrets.token_urlsafe(32)

        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(directory), **kwargs)

        def valid_host(self):
            host = urlsplit('//'+self.headers.get('Host', '')).hostname
            return host in ('localhost', '127.0.0.1', '::1') or preview and host == 'terminal.local'

        def response(self, data, status=200, cookie=False):
            encoded = json.dumps(data, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Content-Length', str(len(encoded)))
            if cookie:
                self.send_header('Set-Cookie', 'leap_local_operator='+self.csrf+'; HttpOnly; SameSite=Strict; Path=/api/local/')
            self.end_headers()
            self.wfile.write(encoded)

        def do_GET(self):
            if not self.valid_host():
                return self.response({'error': 'Host tidak diizinkan.'}, 403)
            if self.path == '/api/local/attendance/bootstrap':
                return self.response({'local_only': True, 'csrf': self.csrf, 'database': 'SQLite lokal'}, cookie=True)
            parts = Path(urlsplit(self.path).path).parts
            if any(x.startswith('.') or x == 'data-lokal' for x in parts) or Path(self.path).suffix in ('.sqlite3', '.sqlite', '.db', '.py'):
                return self.response({'error': 'File tidak dapat diakses.'}, 403)
            return super().do_GET()

        def list_directory(self, path):
            return self.response({'error': 'Daftar direktori tidak tersedia.'}, 403)

        def do_POST(self):
            if not self.valid_host():
                return self.response({'error': 'Host tidak diizinkan.'}, 403)
            origin = urlsplit(self.headers.get('Origin', '')).netloc
            allowed_origin = origin == self.headers.get('Host') or preview and origin == 'terminal.local:4173'
            cookie = SimpleCookie(self.headers.get('Cookie', ''))
            value = cookie.get('leap_local_operator')
            token = self.headers.get('X-LEAP-CSRF', '')
            if not allowed_origin or not value or not secrets.compare_digest(value.value, self.csrf) or not secrets.compare_digest(token, self.csrf):
                return self.response({'error': 'Buka halaman pengurus lokal pada server yang sama terlebih dahulu.'}, 403)
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= 1500000 or self.headers.get_content_type() != 'application/json':
                    raise Invalid('Permintaan tidak sah.')
                p = json.loads(self.rfile.read(length))
                if not isinstance(p, dict):
                    raise Invalid('Format permintaan tidak benar.')
                action = self.path.removeprefix('/api/local/attendance/')
                if not self.path.startswith('/api/local/attendance/') or action not in ('sync', 'card', 'event', 'scan', 'correct', 'close', 'state'):
                    raise Invalid('Alamat layanan tidak ditemukan.', 404)
                return self.response(getattr(database, action)(p))
            except Invalid as error:
                return self.response({'error': str(error)}, error.status)
            except (ValueError, TypeError, KeyError, sqlite3.Error):
                return self.response({'error': 'Permintaan belum dapat disimpan. Periksa data dan coba lagi; tidak ada keberhasilan yang dicatat.'}, 400)

    return Handler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=int(os.environ.get('PORT', '8767')))
    parent = Path(__file__).resolve().parent
    parser.add_argument('--directory', type=Path, default=parent if (parent/'app').is_dir() else parent.parent/'.local-management')
    parser.add_argument('--database', type=Path)
    parser.add_argument('--preview', action='store_true', help='Managed Work Mode preview only')
    parser.add_argument('--host', default=None, help='Loopback by default; preview runner may supply its internal bind address')
    parser.add_argument('--strictPort', action='store_true', help=argparse.SUPPRESS)
    args = parser.parse_args()
    folder = args.directory.resolve()
    path = args.database or folder/'data-lokal'/'kehadiran.sqlite3'
    path.parent.mkdir(parents=True, exist_ok=True)
    db = AttendanceDB(path)
    host = args.host or ('0.0.0.0' if args.preview else '127.0.0.1')
    if not args.preview and host not in ('127.0.0.1', 'localhost'):
        parser.error('Mode lokal hanya dapat diikat ke localhost. Hosting lintas perangkat memerlukan autentikasi dan HTTPS produksi.')
    server = ThreadingHTTPServer((host, args.port), handler_for(db, folder, args.preview))
    print(f'IPB LEAP lokal: http://localhost:{server.server_port}/app/kelola-program.html', flush=True)
    print(f'Database SQLite lokal: {path}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
