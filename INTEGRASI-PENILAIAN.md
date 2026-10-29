## Pembaruan alur per peran — 29 Oktober 2026

Sumber: keputusan pengguna di chat 9 Oktober dan 29 Oktober, materi POC/ABC, dan playbook Asisten Mentor yang ditemukan melalui penelusuran konteks percakapan. Halaman publik ipbleap.com saat diperiksa masih Segera Hadir; isi ERP di balik login tidak diperiksa dengan akun pengguna.

Preview kini memiliki pemilih peran Mentee / Asisten Mentor / Mentor / Tim Penilaian M12. Mentee mengisi; Asmen memeriksa kelengkapan ABC, komitmen, proses dan bukti; Mentor membaca sumber, menyepakati POC dan menetapkan KPI M3/M6/M9 serta P3 M6; Tim Penilaian menetapkan M12. Tidak ada perubahan rumus atau bobot. P1 dan P4 ditampilkan hanya baca pada keputusan Mentor agar pemeriksaan tidak diulang. 360 tetap bahan pertimbangan satu P3.

Atas instruksi terbaru pengguna, isi menu Program/Kelompok disesuaikan per tugas. Markup topbar, CSS, warna, logo, font dan komponen visual tetap persis asli. Modul lain tetap tersedia. URL pilihan peran hanya digunakan untuk preview; peran operasional diambil dari actor terverifikasi dan seluruh tindakan tetap diperiksa server.

39 tes lokal lulus, termasuk pengisian mentee, pembatasan pemeriksaan Asmen, keputusan Mentor, pembatasan M12 serta menu sesuai peran. Preview tetap kosong dan tidak menyimpan atau menerbitkan data.

---

# Integrasi penilaian IPB LEAP — 29 Oktober 2026 (WIB)

Status integrasi operasional: perubahan source pada branch `integrate/assessment-20261029`. Tidak di-merge, tidak di-deploy, tidak ada SQL yang diterapkan pada database aktif. Pengujian lintas peran dilakukan di database PostgreSQL lokal terisolasi, bukan dengan akun produksi.

## Update ruang lingkup review

Preview statis terisolasi di `docs/review-penilaian/` disiapkan untuk GitHub Pages. Hanya isi penilaian yang baru; Navbar memakai komponen asli tanpa perubahan. Formulir kosong dapat ditinjau dan diketik, tetapi tombol simpan/terbit tidak aktif. Preview tidak memuat config/kunci/Supabase SDK, tidak membaca akun atau jawaban, dan tidak mengirim permintaan ke backend. Semua tautan modul lain menuju halaman asli.

Penerbitan preview tidak menggabungkan integrasi operasional: hanya folder review tambahan yang ditaruh pada versi GitHub Pages. Database dan Edge tetap tidak berubah.

## Dasar dan pemetaan proyek

Dasar tampilan: commit `268c72681e65a53015b28ccd0ba064b1b7b303f8`, bukan kerangka ERP lama dari ZIP. `src/public` adalah website publik; `src/app` berisi komponen desain DC; `tools/build.py` menghasilkan `docs`. Navbar dan runtime template tetap digunakan. Semua halaman publik dipertahankan byte demi byte. Seluruh rute ERP lama tetap tersedia.

Sebelum integrasi, penilaian hanya prototype `Penilaian.dc.html`: angka contoh, gabungan 50/50 Asmen–Mentor, rentang dan asumsi anonimitas berbeda, serta tombol yang hanya mengubah state tampilan. Tidak ada penyimpanan 360 yang dapat digunakan kembali. Kerangka visual/form pattern disesuaikan; rumus dan asumsi lama tidak dipakai. Rute yang sama kini membuka penilaian P1–P4; tidak ada dua formulir aktif. Kartu nilai bulanan mentee, grafik, hero, login umum, monitoring dan Navbar dikembalikan persis ke source aslinya sesuai arahan terakhir. Kartu bulanan lama tetap bagian prototype dan tidak dialihkan menjadi hasil P1–P4.

Repo semula tidak memiliki konfigurasi backend. Pemeriksaan read-only melalui koneksi Supabase menemukan proyek bernama IPB LEAP ERP, tabel `erp_*`, RPC workspace/revision/commit, dan Edge `erp-records`/`erp-account` yang sudah aktif. Konfigurasi frontend memakai URL dan publishable key proyek tersebut. Tidak ada akun, kata sandi, token aktivasi, maupun service key yang disalin. Akun, penugasan, cohort dan data aktif tidak diubah.

## Lokasi menu dan tanggung jawab

| Peran | Jalur | Fungsi |
|---|---|---|
| Mentee | Program → POC / Worksheet ABC / Progres & Bukti / Raport | Draft/pengajuan/perbaikan jawaban sendiri; raport terbit |
| Asisten Mentor | Kelompok → Penilaian mentee → pilih mentee | Pemeriksaan ABC, tindak lanjut komitmen, proses check-in dan bukti; tanpa edit jawaban atau menetapkan level KPI |
| Mentor | Kelompok → Penilaian mentee → pilih mentee | Kesepakatan POC; keputusan KPI M3/M6/M9 dan enam kompetensi M6 |
| Tim Penilaian | Program → Penilaian & rubric → M12 | Penilaian akhir hanya untuk staf dengan `can_assess` |
| Pengamat | Program/Kelompok → Tugas pengamat 360 | Hanya tugas yang diberikan; draft, pengajuan, perbaikan dan riwayat |
| Pengelola | Program → Pengamat 360 | Kebijakan dan penugasan sesuai izin pengelolaan; tidak otomatis membaca masukan |
| Bendahara / Super Admin | Menu tugas yang sudah ada | Tidak otomatis memperoleh hak baca jawaban atau hak menilai |

Konteks cohort, kelompok, mentee, periode dan referensi sumber diteruskan melalui tab modul dan link Navbar. Peran tampilan hanya dapat memilih peran yang benar-benar dimiliki akun. Otoritas tetap diperiksa di server.

## Fungsi yang tersambung pada source

- `src/assets/assessment/app.mjs`: POC, ABC, progres, pemeriksaan, keputusan capaian dan raport memakai kontrak RPC/Edge yang sama dari ZIP. Modul dipasang dalam shell/Navbar proyek yang sekarang; halaman home/sistem/keuangan dari ZIP tidak digunakan untuk mengganti ERP.
- `api.mjs` dan `login.mjs`: autentikasi penilaian memakai halaman baru `akses-penilaian.html`. Login umum prototype tidak diubah. Peran/identitas terverifikasi dikelola di isi penilaian; Navbar asli tidak diganti.
- `domain.mjs` frontend/backend identik dengan sumber paket. Bobot, ambang, pembulatan dan persyaratan M3/M6/M9/M12 tidak berubah. ABC tanpa skor dan tanpa kewajiban referensi POC. Green/Yellow/Red, status catatan, status komitmen, dan level KPI terpisah.
- Penyimpanan versi, pemeriksa, sumber POC/ABC/kegiatan/bukti, dan publikasi memakai tabel/backend yang ada. Waktu ditampilkan WIB. ID catatan dan request tetap sama saat mengulang permintaan identik yang gagal; konflik tidak menghapus isian.
- `sources.mjs` menambahkan pemeriksaan versi sumber yang juga menangkap perubahan proses, jadwal, pembatalan dan publikasi M6 untuk M9. Ini lapisan versi, bukan rumus baru. Edge menghitung ulang dan memvalidasi envelope sebelum publikasi; revision/cohort locking tetap digunakan.
- `observer.mjs` dan kandidat SQL `backend/erp/pending/360.sql`: kebijakan eksplisit, penugasan, draft/pengajuan/perbaikan, versi, izin baca, pembatalan, audit dan referensi publikasi. Panel masukan berada pada enam kompetensi P3 yang sama. Tidak ada total/rata-rata 360. Penilai memilih satu level akhir per kompetensi dan versi masukan yang dipertimbangkan.
- Masukan pengamat tidak dibuka otomatis kepada mentee atau pengelola penugasan. Raport menyimpan referensi versi, bukan jawaban pribadi pengamat. Versi lama tetap tersimpan. Kebijakan identitas tidak boleh diubah diam-diam setelah penugasan dimulai.

## Yang belum aktif dan keputusan yang diperlukan

1. **360 belum aktif di Supabase.** Kandidat SQL tambahan harus ditinjau dan diterapkan melalui proses deployment berikutnya. Frontend menampilkan penjelasan jika RPC belum tersedia; tidak menampilkan keberhasilan pengiriman palsu.
2. **Kebijakan pengamat belum diputuskan.** Jenis hubungan, jumlah maksimum per mentee/periode, dan anonimitas tidak memiliki default. Catatan keputusan dan pilihan eksplisit diperlukan sebelum pengumpulan dapat diaktifkan. Tidak ada syarat jumlah minimum untuk menerbitkan raport yang dibuat-buat; masukan tetap advisory.
3. **Edge `erp-records` belum diperbarui.** Source menambahkan origin GitHub Pages dan pemeriksaan snapshot sumber; layanan aktif masih memakai daftar origin sebelumnya. Maka penyimpanan dari origin GitHub belum dapat dinyatakan berjalan sampai perubahan Edge di-deploy. Login/RPC dan Edge write adalah jalur berbeda.
4. **Belum diuji dengan akun nyata lintas peran.** Tidak ada kredensial pengguna yang dipakai atau akun uji yang ditambahkan ke produksi. Setelah deployment staging, perlu uji sign-in/aktivasi, CORS, RPC/Edge, penerbitan dan muat ulang melalui browser dengan akun yang ditugaskan.
5. **ERP lain tetap prototype.** Kalender, event, pengumuman, monitoring, sesi, proker/task, file, template, keuangan, chat, profil, pengaturan, sistem serta halaman publik dipertahankan. Keberadaan tampilannya bukan klaim bahwa semua modul sudah memiliki backend. Tidak ada email/notifikasi otomatis yang ditambahkan.

## Pengujian

`npm ci` lalu `npm test`, dan `npm run build`.

- Tes domain paket dan tambahan M6/M9/M12: baseline/patokan naik-turun, ABC sebelum POC, tiga prioritas Kick-off, bukti, jadwal proses, sumber lama, portofolio M12, P3 M9 dari publikasi M6, serta 360 tidak mengubah hitungan.
- PostgreSQL lokal (PGlite) dengan salinan skema relevan sebagai fixture: draft → pengajuan → perbaikan → pengajuan ulang; pemeriksaan ABC/komitmen/POC/proses/bukti; publikasi; reload versi; konflik; pembatasan Mentee/Asmen/Mentor/Tim Penilaian/Bendahara/Super Admin; penolakan commit langsung dari browser.
- PostgreSQL lokal 360: kebijakan awal nonaktif, penugasan, akses jawaban, identitas anonim, draft/pengajuan/perbaikan, alasan perbaikan, revisi stale, referensi ganda/stale, dan sumber publikasi tanpa membuka jawaban pengamat.
- Tes DOM: tombol/form ABC tersambung ke command, persistensi melalui reload fixture, isian tetap utuh saat gagal, request ID saat retry, konteks navigasi, serta tidak ada form untuk akun tanpa hak subject.
- Tes regresi: halaman publik identik, rute ERP lama tetap ada, satu penilaian aktif, aturan frontend/backend identik, fixture tidak masuk direktori aset deployment.
- Browser preview: login glossy nyata tanpa formulir aktivasi terbuka secara keliru; ABC dan penilaian M6 pada iframe 360 px dan desktop. Overflow Navbar ditemukan lalu diperbaiki. CSS reduced motion dipertahankan; jalur scroll error saat reduced motion diuji melalui DOM. Pengaturan reduced motion OS/browser tidak diubah dalam QA.

`tests/fixtures/prepare-preview.mjs` hanya membuat `.qa/` yang diabaikan Git untuk pemeriksaan visual dengan data bertanda UJI LOKAL, tanpa Supabase. Jangan deploy `.qa/`. Fixture skema di `tests/fixtures/schema/` bukan installer; jangan menjalankannya di database aktif.

## Urutan deployment berikutnya (belum dijalankan)

Tinjau kandidat SQL terhadap definisi aktif dan jalankan di staging; jangan jalankan seluruh SQL ZIP. SQL 360 membuat tabel/RPC tambahan dan patch terjaga pada satu titik publikasi, tidak melakukan reset. Terapkan hanya setelah peninjauan. Deploy Edge `records.ts`, `domain.mjs` dan `sources.mjs` sebagai `erp-records` tanpa mengganti akun atau layanan lain. Kemudian verifikasi akun staging, CORS dan workflow lintas peran. Aktivasi pengumpulan 360 tetap menunggu keputusan kebijakan. Merge/publikasi frontend hanya setelah instruksi pemilik berikutnya.
