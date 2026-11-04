"""Local GROW workflow. Preview roles are deliberately not real authentication."""
import copy
import hashlib
import json
import re
import sqlite3
import uuid
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
CATALOG = json.loads((ROOT / 'src/assets/grow/catalog.json').read_text())
PERIODS = (3, 6, 9, 12)
START = date(2026, 11, 1)
FINISH = date(2027, 10, 31)
JAKARTA = ZoneInfo('Asia/Jakarta')


def timestamp():
    return datetime.now(JAKARTA).isoformat()


class Invalid(ValueError):
    pass


class Conflict(Invalid):
    pass


def need(value, label):
    if not isinstance(value, str) or not value.strip():
        raise Invalid('Lengkapi ' + label + '.')
    if len(value) > 10000:
        raise Invalid('Isian terlalu panjang: ' + label)


def calendar(value):
    try:
        return date.fromisoformat(value)
    except (ValueError, TypeError):
        raise Invalid('Tanggal belum benar.')


def period_for(value):
    d = calendar(value)
    if not START <= d <= FINISH:
        raise Invalid('Tanggal harus berada dalam periode November 2026–Oktober 2027.')
    m = (d.year - START.year) * 12 + d.month - START.month + 1
    return ((m - 1) // 3 + 1) * 3


def safe_url(value):
    from urllib.parse import urlsplit
    if value and (urlsplit(value).scheme not in ('http', 'https') or not urlsplit(value).netloc):
        raise Invalid('Tautan bukti harus berupa alamat http atau https yang lengkap.')


def initial():
    return {'canvas': None, 'canvasHistory': [], 'notes': [], 'sessions': [], 'reviews': {}, 'publications': [], 'supportReplies': {}}


def source_signature(s, period):
    notes = [n for n in s['notes'] if n['status'] == 'Diajukan' and n['period'] == period]
    return hashlib.sha256(json.dumps(notes, sort_keys=True).encode()).hexdigest()


def score(s, period, today):
    notes = [n for n in s['notes'] if n['status'] == 'Diajukan' and n['period'] == period]
    eligible = [n for n in notes if n.get('outcome', {}).get('status') == 'Selesai' or calendar(n['data']['due']) < today]
    checked = [n for n in eligible if n.get('check') and n['check']['outcomeRevision'] == n.get('outcomeRevision', 0)]
    asmen = round(sum(sum(n['check']['data'][k] for k in ('execution', 'timeliness', 'evidence')) for n in checked) / len(checked), 2) if checked and len(checked) == len(eligible) else None
    review = s['reviews'].get(str(period))
    canvas = s['canvas']
    mentor = round(sum(x['level'] for x in review['items']) / len(review['items']) * .7, 2) if review and canvas and review['canvasVersion'] == canvas['version'] and review.get('sources') == source_signature(s, period) else None
    return {'asmen': asmen, 'mentor': mentor, 'total': round(asmen + mentor, 2) if asmen is not None and mentor is not None else None, 'eligible': len(eligible), 'checked': len(checked), 'waiting': len(notes) - len(eligible)}


class Store:
    def __init__(self, filename, today=None):
        self.filename = str(filename)
        self.today = today or datetime.now(JAKARTA).date()
        with self.connect() as db:
            db.execute('create table if not exists workspaces(track text primary key, revision integer not null, payload text not null)')
            db.execute('create table if not exists events(id integer primary key, track text, role text, action text, at text, payload text)')

    def connect(self):
        return sqlite3.connect(self.filename, timeout=10)

    def _load(self, db, track):
        if track not in [t['id'] for t in CATALOG]:
            raise Invalid('Track tidak tersedia.')
        row = db.execute('select revision,payload from workspaces where track=?', (track,)).fetchone()
        if not row:
            return 0, initial()
        state = json.loads(row[1])
        state.setdefault('sessions', [])
        return row[0], state

    def view(self, track, role):
        if role not in ('mentee', 'asmen', 'mentor'):
            raise Invalid('Pilih peran pratinjau yang tersedia.')
        with self.connect() as db:
            revision, s = self._load(db, track)
        result = copy.deepcopy(s)
        if role == 'mentee':
            result['sessions'] = [x for x in result['sessions'] if x['status'] == 'Tercatat']
        if role != 'mentee':
            if result['canvas'] and result['canvas']['status'] == 'Draft':
                result['canvas'] = None
            result['canvasHistory'] = [c for c in result['canvasHistory'] if c['status'] != 'Draft']
            result['notes'] = [n for n in result['notes'] if n['status'] != 'Draft']
        result['scores'] = {str(p): score(s, p, self.today) for p in PERIODS}
        result.update(revision=revision, track=track, role=role, today=self.today.isoformat())
        return result

    def command(self, track, role, action, data, expected):
        allowed = {'mentee': {'canvas_save', 'canvas_submit', 'note_save', 'note_submit', 'outcome_save'}, 'asmen': {'canvas_check', 'action_check', 'session_save'}, 'mentor': {'canvas_agree', 'canvas_return', 'support_reply', 'review_save', 'publish', 'session_save'}}
        if action not in allowed.get(role, set()):
            raise Invalid('Tindakan ini tidak tersedia untuk peran pratinjau tersebut.')
        if len(json.dumps(data)) > 100000:
            raise Invalid('Isian terlalu panjang.')
        with self.connect() as db:
            db.execute('begin immediate')
            revision, s = self._load(db, track)
            if expected != revision:
                raise Conflict('Data berubah di tampilan lain. Muat ulang; isianmu belum dikirim.')
            self.mutate(s, track, role, action, copy.deepcopy(data))
            db.execute('insert into workspaces values(?,?,?) on conflict(track) do update set revision=excluded.revision,payload=excluded.payload', (track, revision + 1, json.dumps(s)))
            db.execute('insert into events(track,role,action,at,payload) values(?,?,?,?,?)', (track, role, action, timestamp(), json.dumps(data)))
        return self.view(track, role)

    def mutate(self, s, track, role, action, d):
        canvas = s['canvas']
        if action in ('canvas_save', 'canvas_submit'):
            if canvas and canvas['status'] not in ('Draft', 'Perlu perbaikan'):
                raise Invalid('GROW yang diajukan atau disepakati tidak ditulis ulang. Gunakan Catat Mentoring.')
            catalogue = next(t for t in CATALOG if t['id'] == track)
            ids = [k['id'] for k in d.get('kpis', [])]
            if len(set(ids)) != len(ids) or any(i not in [k['id'] for k in catalogue['kpis']] for i in ids):
                raise Invalid('Pilih KPI dari katalog track ini.')
            if action == 'canvas_submit':
                for k in ('goal', 'why', 'reality', 'options', 'wayForward', 'mentorNeed'):
                    need(d.get(k), {'goal': 'tujuan', 'why': 'alasan tujuan', 'reality': 'kondisi awal', 'options': 'pilihan strategi', 'wayForward': 'langkah awal', 'mentorNeed': 'dukungan Mentor (boleh Tidak ada)'}[k])
                if not ids:
                    raise Invalid('Pilih sedikitnya satu KPI yang relevan.')
                for k in d['kpis']:
                    need(k.get('baseline'), 'baseline KPI')
                    need(k.get('measurement'), 'cara ukur dan bukti KPI')
                    for p in PERIODS:
                        need(k.get('milestones', {}).get(str(p)), 'milestone M' + str(p))
                    source = next(i for i in catalogue['kpis'] if i['id'] == k['id'])
                    if k['milestones']['12'] != source['label']:
                        raise Invalid('Target M12 mengikuti KPI pada gambar sumber.')
            version = (canvas or {}).get('version', 0) + 1
            if canvas:
                s['canvasHistory'].append(copy.deepcopy(canvas))
            s['canvas'] = {'version': version, 'data': d, 'status': 'Diajukan' if action == 'canvas_submit' else 'Draft', 'at': timestamp()}
        elif action in ('canvas_check', 'canvas_agree', 'canvas_return'):
            if not canvas or canvas['status'] not in ('Diajukan', 'Siap dibahas Mentor'):
                raise Invalid('Belum ada GROW yang dapat diperiksa.')
            need(d.get('comment'), 'catatan pendamping')
            if action == 'canvas_check':
                if d.get('decision') not in ('Siap dibahas Mentor', 'Perlu perbaikan'):
                    raise Invalid('Pilih hasil pemeriksaan.')
                canvas['status'] = d['decision']
                canvas['asmenComment'] = d['comment']
            else:
                if action == 'canvas_agree' and canvas['status'] != 'Siap dibahas Mentor':
                    raise Invalid('Pemeriksaan Asmen belum selesai.')
                canvas['status'] = 'Disepakati' if action == 'canvas_agree' else 'Perlu perbaikan'
                canvas['mentorComment'] = d['comment']
        elif action == 'session_save':
            try:
                session_id = str(uuid.UUID(d.get('id', '')))
            except (ValueError, TypeError, AttributeError):
                raise Invalid('Referensi sesi belum benar.')
            old = next((x for x in s['sessions'] if x['id'] == session_id), None)
            status = d.get('status')
            values = d.get('data', {})
            if status not in ('Draft', 'Tercatat'):
                raise Invalid('Pilih status sesi yang tersedia.')
            if old and old['status'] == 'Tercatat' and status == 'Draft':
                raise Invalid('Sesi tercatat tidak dikembalikan menjadi draft; simpan pembaruan sesi.')
            if values.get('kind') not in ('group', 'one'):
                raise Invalid('Pilih sesi kelompok atau 1-on-1.')
            people = values.get('attendance', [])
            if not isinstance(people, list) or len(people) > 5 or any(not isinstance(p, dict) for p in people):
                raise Invalid('Daftar peserta sesi belum benar.')
            ids = [p.get('id') for p in people]
            if len(ids) != len(set(ids)) or any(not isinstance(i, str) or not i for i in ids):
                raise Invalid('Referensi peserta sesi harus berbeda.')
            for p in people:
                if p.get('status') not in ('', 'Hadir', 'Izin', 'Absen'):
                    raise Invalid('Pilih Hadir, Izin, atau Absen.')
            safe_url(values.get('photoUrl', ''))
            safe_url(values.get('materialUrl', ''))
            if status == 'Tercatat':
                for key, label in [('date', 'tanggal sesi'), ('topic', 'topik sesi'), ('summary', 'ringkasan diskusi')]:
                    need(values.get(key), label)
                period_for(values['date'])
                if calendar(values['date']) > self.today:
                    raise Invalid('Sesi yang belum berlangsung dapat disimpan sebagai draft.')
                duration = values.get('duration')
                if type(duration) is not int or not 1 <= duration <= 720:
                    raise Invalid('Isi durasi sesi antara 1 dan 720 menit.')
                if values.get('format') not in ('Online', 'Offline', 'Hybrid'):
                    raise Invalid('Pilih format sesi.')
                if not people or (values['kind'] == 'one' and len(people) != 1):
                    raise Invalid('Isi peserta sesi. Sesi 1-on-1 memiliki satu peserta.')
                for p in people:
                    need(p.get('name'), 'nama peserta sesi lokal')
                    if not p.get('status'):
                        raise Invalid('Isi status kehadiran setiap peserta.')
            for a in values.get('actions', []):
                need(a.get('text'), 'tindak lanjut sesi')
                if a.get('who') not in ['all', *ids]:
                    raise Invalid('Tindak lanjut ditujukan kepada peserta sesi ini.')
                if a.get('due'):
                    period_for(a['due'])
                    if values.get('date') and calendar(a['due']) < calendar(values['date']):
                        raise Invalid('Tenggat tindak lanjut tidak boleh sebelum sesi.')
            history = copy.deepcopy(old.get('history', [])) if old else []
            if old:
                history.append({k: copy.deepcopy(v) for k, v in old.items() if k != 'history'})
            entry = {'id': session_id, 'status': status, 'data': values, 'version': old['version'] + 1 if old else 1, 'by': role, 'at': timestamp(), 'history': history}
            if old:
                s['sessions'][s['sessions'].index(old)] = entry
            else:
                s['sessions'].append(entry)
        elif action in ('note_save', 'note_submit'):
            old = next((n for n in s['notes'] if n['id'] == d.get('id')), None)
            if old and old['status'] != 'Draft':
                raise Invalid('Catatan yang diajukan tetap menjadi riwayat. Buat catatan pertemuan berikutnya.')
            values = d.get('data', {})
            if values.get('kind') and values['kind'] not in ('Sesi kelompok', '1-on-1', 'Common Class'):
                raise Invalid('Pilih jenis sesi yang tersedia.')
            if values.get('format') and values['format'] not in ('Online', 'Offline', 'Hybrid'):
                raise Invalid('Pilih format sesi yang tersedia.')
            if values.get('time') and not re.fullmatch(r'([01][0-9]|2[0-3]):[0-5][0-9]', values['time']):
                raise Invalid('Isi jam sesi dengan format waktu yang benar (WIB).')
            linked = None
            if values.get('session'):
                linked = next((x for x in s['sessions'] if x['id'] == values['session'] and x['status'] == 'Tercatat'), None)
                if not linked:
                    raise Invalid('Pilih sesi tercatat yang tersedia di ruang lokal ini.')
                if values.get('date') != linked['data']['date']:
                    raise Invalid('Tanggal catatan harus sesuai dengan sesi terkait.')
            if action == 'note_submit':
                for k in ('learning', 'action', 'due', 'date'):
                    need(values.get(k), {'learning': 'apa yang didapat', 'action': 'action berikutnya', 'due': 'tenggat', 'date': 'tanggal pertemuan'}[k])
                if calendar(values['date']) > self.today:
                    raise Invalid('Tanggal pertemuan tidak boleh melewati hari ini.')
                period_for(values['date'])
                period_for(values['due'])
                if calendar(values['due']) < calendar(values['date']):
                    raise Invalid('Tenggat tidak boleh sebelum pertemuan.')
            note = {'id': old['id'] if old else str(uuid.uuid4()), 'status': 'Diajukan' if action == 'note_submit' else 'Draft', 'data': values, 'period': period_for(values['date']) if values.get('date') else 3, 'canvasVersion': canvas['version'] if canvas and canvas['status'] == 'Disepakati' else None, 'sessionVersion': linked['version'] if linked else None, 'outcomeRevision': 0}
            if old:
                s['notes'][s['notes'].index(old)] = note
            else:
                s['notes'].append(note)
        elif action in ('outcome_save', 'action_check'):
            note = next((n for n in s['notes'] if n['id'] == d.get('id') and n['status'] == 'Diajukan'), None)
            if not note:
                raise Invalid('Catatan tidak ditemukan atau belum diajukan.')
            if action == 'outcome_save':
                if d.get('status') not in ('Belum berjalan', 'Sebagian', 'Selesai'):
                    raise Invalid('Pilih status action.')
                need(d.get('result'), 'hasil atau hambatan')
                safe_url(d.get('url', ''))
                if d['status'] == 'Selesai':
                    completed = calendar(d.get('completed'))
                    if completed < calendar(note['data']['date']) or completed > self.today:
                        raise Invalid('Tanggal selesai harus sesuai waktu pelaksanaan.')
                note['outcomeHistory'] = note.get('outcomeHistory', []) + ([copy.deepcopy(note['outcome'])] if note.get('outcome') else [])
                note['outcome'] = d
                note['outcomeRevision'] += 1
            else:
                outcome = note.get('outcome', {})
                if outcome.get('status') != 'Selesai' and calendar(note['data']['due']) >= self.today:
                    raise Invalid('Action belum jatuh tempo. Tandai Menunggu, belum diberi poin.')
                for k in ('execution', 'timeliness', 'evidence'):
                    if type(d.get(k)) is not int or d[k] not in (0, 5, 10):
                        raise Invalid('Pilih poin 0, 5, atau 10 untuk setiap aspek.')
                need(d.get('comment'), 'alasan pemeriksaan Asmen')
                if d['execution'] == 10 and outcome.get('status') != 'Selesai':
                    raise Invalid('Poin selesai memerlukan laporan action selesai dari mentee.')
                if d['timeliness'] > 0 and d['execution'] != 10:
                    raise Invalid('Poin selesai tepat waktu atau terlambat memerlukan action yang dinilai selesai.')
                if d['timeliness'] == 0 and d['execution'] == 10:
                    raise Invalid('Untuk action selesai, pilih selesai tepat waktu atau selesai terlambat.')
                if d['timeliness'] == 10 and (outcome.get('status') != 'Selesai' or calendar(outcome['completed']) > calendar(note['data']['due'])):
                    raise Invalid('Poin tepat waktu memerlukan tanggal selesai paling lambat pada tenggat.')
                if d['timeliness'] == 5 and (outcome.get('status') != 'Selesai' or calendar(outcome['completed']) <= calendar(note['data']['due'])):
                    raise Invalid('Poin terlambat memerlukan laporan selesai setelah tenggat.')
                if d['evidence'] > 0 and not outcome.get('result'):
                    raise Invalid('Belum ada hasil/bukti yang dapat diperiksa.')
                note['check'] = {'data': d, 'outcomeRevision': note['outcomeRevision']}
        elif action == 'support_reply':
            key = d.get('key')
            valid = key == 'canvas' and canvas and canvas['status'] != 'Draft'
            valid = valid or any(n['id'] == key and n['status'] == 'Diajukan' and n['data'].get('mentorNeed') for n in s['notes'])
            if not valid:
                raise Invalid('Kebutuhan pendampingan tidak tersedia.')
            need(d.get('reply'), 'tanggapan Mentor')
            if d.get('status') not in ('Dibahas', 'Ditindaklanjuti'):
                raise Invalid('Pilih status tanggapan.')
            s['supportReplies'][key] = {'reply': d['reply'], 'status': d['status'], 'at': timestamp()}
        elif action == 'review_save':
            if not canvas or canvas['status'] != 'Disepakati':
                raise Invalid('GROW belum disepakati.')
            p = d.get('period')
            if p not in PERIODS:
                raise Invalid('Pilih periode review.')
            items = d.get('items', [])
            if sorted(x['id'] for x in items) != sorted(k['id'] for k in canvas['data']['kpis']):
                raise Invalid('Nilai semua KPI yang dipilih dalam GROW.')
            for x in items:
                if type(x.get('level')) is not int or x['level'] not in (0, 25, 50, 75, 100):
                    raise Invalid('Pilih capaian 0, 25, 50, 75, atau 100.')
                need(x.get('actual'), 'hasil aktual milestone')
                need(x.get('reason'), 'alasan penilaian')
                safe_url(x.get('url', ''))
                if x['level'] and not x.get('url') and not x.get('evidence'):
                    raise Invalid('Cantumkan bukti hasil atau uraian bukti yang diperiksa.')
            s['reviews'][str(p)] = {'items': items, 'canvasVersion': canvas['version'], 'comment': d.get('comment', ''), 'sources': source_signature(s, p)}
        elif action == 'publish':
            p = d.get('period')
            if p not in PERIODS:
                raise Invalid('Periode tidak tersedia.')
            result = score(s, p, self.today)
            if result['total'] is None:
                raise Invalid('Raport belum lengkap: perlu review Mentor dan pemeriksaan Asmen untuk action yang sudah layak dinilai.')
            publication = {'id': str(uuid.uuid4()), 'period': p, 'score': result, 'canvasVersion': canvas['version'], 'canvas': copy.deepcopy(canvas), 'review': copy.deepcopy(s['reviews'][str(p)]), 'actions': copy.deepcopy([n for n in s['notes'] if n['status'] == 'Diajukan' and n['period'] == p]), 'at': timestamp()}
            s['publications'].append(publication)
