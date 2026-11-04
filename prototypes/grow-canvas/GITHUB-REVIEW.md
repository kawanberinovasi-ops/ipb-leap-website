# GROW Canvas — paket review GitHub

Status: siap dipush sebagai **branch pratinjau**, belum merupakan pengganti aplikasi produksi.

Repository tujuan: https://github.com/kawanberinovasi-ops/ipb-leap-website

Branch lokal: `codex/grow-canvas-preview-20261104`.

Dasar branch: `main` pada commit `d358989e910f8e0be6de3381543abc4899a4daba`, diperiksa 4 November 2026. Seluruh perubahan branch ini berada di `prototypes/grow-canvas/`. Halaman produksi di `src/` dan `docs/` pada akar repository tidak ditimpa.

## Hasil yang direview

- GROW Canvas sebagai pegangan awal, North Star tetap, katalog KPI dari gambar sumber, milestone M3/M6/M9/M12.
- Mentee: GROW Canvas, Catat Mentoring, Raport.
- Asmen/Mentor: Kelompok, Review GROW, Review Catatan Mentee, Raport. Catat Sesi tetap terbuka dari Kelompok.
- Form mentee memuat detail sesi, pembelajaran, action berikutnya, tenggat, dan kebutuhan dukungan Mentor.
- Progres, bukti, pemeriksaan proses, penilaian milestone, serta hasil terbit berada dalam Raport.
- Kartu **raport terbit hanya menampilkan Total nilai /100** untuk semua peran. Sumber nilai tetap tersimpan dan digunakan dalam perhitungan.
- Bobot lokal tetap: Asmen maksimal 30, Mentor maksimal 70. Perubahan tampilan total tidak mengubah rumus atau snapshot terdahulu.
- Mode latihan terpisah, dapat dicoba dari hasil mentee sampai penilaian dan penerbitan; contoh latihan tidak masuk ruang isian biasa.

## Menjalankan setelah checkout

Python 3.9+ dengan database zona waktu Asia/Jakarta. Node.js diperlukan hanya untuk pemeriksaan sintaks JavaScript. Tidak membutuhkan pemasangan paket Python tambahan.

```sh
cd prototypes/grow-canvas
python3 tools/build.py
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v
python3 local/server.py --port 8765
```

Buka `http://127.0.0.1:8765/app/grow-canvas.html` untuk ruang kosong, atau `http://127.0.0.1:8765/app/raport.html?role=asmen&track=social&period=3&demo=assessment` untuk latihan. Pada macOS, `MULAI-LOKAL.command` dapat dijalankan dari folder hasil checkout tanpa mengubah path.

`data/` dibuat saat server dijalankan. Database, backup, kredensial, dan isian pengguna tidak disertakan. `docs/` dalam folder prototype merupakan keluaran build yang diabaikan Git.

## Sebelum dipakai sebagai aplikasi utama

Frontend ini masih memakai API lokal `/api/local/*` dan backend Python/SQLite. Mengunggah HTML ke GitHub Pages tidak menyediakan API tersebut. Pilihan role pratinjau juga bukan login atau otorisasi.

Integrasi produksi berikutnya harus menghubungkan GROW, catatan, penilaian, dan publikasi ke identitas akun serta penugasan kelompok asli; menegakkan kewenangan di server; menyediakan penyimpanan multi-pengguna dan versi sumber; serta memverifikasi akses lintas peran. Tema sesi tetap kosong secara default. Data ABC/POC lama perlu tetap tersedia dan tidak dikonversi otomatis. Bobot penilaian di sini masih usulan lokal; keputusan kelulusan dan penilaian akhir mengikuti keputusan program.

Mode latihan harus tetap terpisah dan tidak muncul sebagai aktivitas atau nilai peserta sebenarnya. Halaman publik dan modul operasional yang disertakan di dalam prototype adalah referensi tampilan, bukan bukti integrasi produksi.

## Push berikutnya

Paket ini disiapkan tanpa push, merge, atau deployment. Push branch pratinjau tidak sama dengan meluncurkan GROW ke IPB LEAP.

Pada checkout yang sudah disiapkan, periksa commit dan jalankan:

```sh
git show --stat HEAD
git push -u origin codex/grow-canvas-preview-20261104
```

Gunakan draft PR ke `main` dengan uraian di `PR-DESCRIPTION.md`. Apabila `main` berubah sebelum push, sinkronkan branch dan ulangi pemeriksaan yang terdampak.
