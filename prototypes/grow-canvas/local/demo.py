"""An explicitly labelled practice case, stored apart from the user's workspace."""
from datetime import date
from model import CATALOG


DEMO_DATE = date(2026, 11, 4)


def seed_assessment(store):
    """Create once; restarting the server preserves the user's practice scores."""
    track = 'social'
    if store.view(track, 'mentee')['revision']:
        return

    def command(role, action, data):
        return store.command(track, role, action, data, store.view(track, role)['revision'])

    kpi = next(k for t in CATALOG if t['id'] == track for k in t['kpis'] if k['id'] == 'socialBeneficiaries')
    command('mentee', 'canvas_submit', {
        'goal': 'Contoh latihan: memperluas penerima manfaat program literasi digital.',
        'why': 'Membantu warga menggunakan layanan digital secara mandiri.',
        'reality': 'Belum ada penerima manfaat yang tercatat. Tim pelaksana sudah tersedia.',
        'options': 'Lokakarya warga, pendampingan kelompok kecil, dan kolaborasi komunitas.',
        'wayForward': 'Mulai dengan satu lokakarya dan verifikasi daftar penerima manfaat.',
        'mentorNeed': 'Masukan untuk memastikan penerima manfaat benar-benar terverifikasi.',
        'kpis': [{'id': kpi['id'], 'baseline': '0 penerima manfaat terverifikasi.',
                  'measurement': 'Jumlah penerima manfaat unik; diperiksa melalui rekap kehadiran dan konfirmasi kegiatan.',
                  'milestones': {'3': '100 penerima manfaat langsung terverifikasi.',
                                 '6': '250 penerima manfaat langsung terverifikasi.',
                                 '9': '375 penerima manfaat langsung terverifikasi.', '12': kpi['label']}}]})
    command('asmen', 'canvas_check', {'decision': 'Siap dibahas Mentor', 'comment': 'Contoh latihan: baseline, bukti, dan milestone sudah lengkap.'})
    command('mentor', 'canvas_agree', {'comment': 'Contoh latihan: target M3 disepakati sebanyak 100 penerima manfaat.'})
    state = command('mentee', 'note_submit', {'data': {
        'kind': '1-on-1', 'number': '1', 'date': '2026-11-02', 'time': '10:00', 'theme': '',
        'format': 'Online', 'topic': 'Verifikasi hasil kegiatan literasi digital',
        'learning': 'Penerima manfaat perlu dihitung per orang unik, disertai bukti keikutsertaan.',
        'action': 'Lengkapi rekap dan verifikasi penerima manfaat dari kegiatan literasi digital.',
        'due': '2026-11-04', 'mentorNeed': ''}})
    command('mentee', 'outcome_save', {'id': state['notes'][-1]['id'], 'status': 'Selesai',
        'result': 'Contoh latihan: rekap selesai tepat waktu. Ada 75 penerima manfaat unik terverifikasi. Dokumentasi ringkas tersedia; beberapa rincian dokumentasi masih perlu dilengkapi.',
        'completed': '2026-11-04', 'url': ''})


def workspace_store(server, mode):
    if mode not in (None, '', 'assessment'):
        from model import Invalid
        raise Invalid('Mode latihan tidak tersedia.')
    return server.demo_store if mode == 'assessment' else server.store
