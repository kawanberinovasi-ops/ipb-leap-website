#!/usr/bin/env python3
"""Package only the empty runnable local preview; never package participant databases or QA."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import argparse

ROOT=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser()
parser.add_argument('output',type=Path)
args=parser.parse_args()
source=ROOT/'.local-management'
prefix='ipbleap-mobile-absensi-lokal'
readme='''IPB LEAP — MOBILE DAN SCAN ABSENSI LOKAL

1. Ekstrak ZIP ke folder ipbleap-mobile-absensi-lokal.
2. Hentikan server lama dengan Control+C.
3. Buka Terminal pada folder hasil ekstrak, lalu jalankan:
   python3 jalankan.py
4. Buka http://localhost:8767/app/kelola-program.html

Jangan gunakan python3 -m http.server untuk paket ini: database membutuhkan jalankan.py.
Tidak perlu npm install. Python 3.9 atau lebih baru dan SQLite bawaan Python sudah cukup.
Untuk pindah port: python3 jalankan.py --port 8768 (ubah alamat browser menjadi localhost:8768).

COBA ALURNYA
- + Cohort -> Tambah akun mentee, track dan pathway.
- Scan absen -> Buat kegiatan -> pilih peserta serta waktu buka/tutup WIB.
- Detail mentee -> Buka QR & riwayat mentee -> tunjukkan QR kepada pengurus.
- Kembali ke pengelola -> Scan Absensi -> pilih kegiatan -> kamera/foto/kode cadangan.
- Hadir tersimpan pada kegiatan, detail/progres mentee dan Kehadiran saya.

Data akun/progres sebelumnya pada localhost:8767 tetap dibaca dari browser yang sama.
Kehadiran baru disimpan dalam file data-lokal/kehadiran.sqlite3 pada folder ini.
Saat memperbarui paket di folder yang sama, pertahankan folder data-lokal.
Paket ini tidak berisi database peserta atau data QA.

BATAS
Ini versi satu operator lokal, belum autentikasi multiuser atau database Supabase produksi.
Tidak membuat akun login produksi, email, notifikasi, atau nilai otomatis.
Kamera memerlukan izin dan HTTPS/localhost. Kamera fisik/HP nyata belum diuji.
Gunakan Foto/unggah QR atau kode cadangan jika kamera tidak tersedia.
Server diikat ke localhost. HP lain tidak memakai alamat localhost laptop ini.
Hosting lintas perangkat memerlukan integrasi akun dan HTTPS berikutnya.
'''
args.output.parent.mkdir(parents=True,exist_ok=True)
with ZipFile(args.output,'w',ZIP_DEFLATED,compresslevel=9) as archive:
    for path in sorted(source.rglob('*')):
        if not path.is_file():continue
        relative=path.relative_to(source)
        if any(part in ('qa','data-lokal','review-penilaian','__pycache__') for part in relative.parts):continue
        if path.suffix in ('.sqlite3','.db','.sqlite','.pyc','.zip','.log'):continue
        archive.write(path,prefix+'/'+relative.as_posix())
    archive.writestr(prefix+'/MULAI-DI-SINI.txt',readme)
with ZipFile(args.output) as archive:
    assert archive.testzip() is None
    names=archive.namelist()
    assert prefix+'/jalankan.py' in names
    assert prefix+'/app/absensi-pengurus.html' in names
    assert prefix+'/assets/assessment/config.mjs' not in names
    assert not any('/data-lokal/' in p or '/qa/' in p for p in names)
print(args.output.resolve(),args.output.stat().st_size,'bytes; verified empty local package')
