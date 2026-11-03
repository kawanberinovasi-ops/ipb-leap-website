> Versi GitHub kini memakai akun bersama dan Supabase. Lihat [integrasi produksi 3 November 2026](INTEGRASI-PENGELOLA-ABSENSI-2026-11-03.md). Dokumen ini tetap menjelaskan build lokal yang terpisah.

# Pengurus dan pengelola — preview lokal 2 November 2026

> Pembaruan mobile dan SQLite kehadiran: [MOBILE-ABSENSI-LOKAL.md](MOBILE-ABSENSI-LOKAL.md). Gunakan `python3 jalankan.py` untuk menjalankan paket terbaru.

Menu: **Program → Kelola Akun & Progres**. Super Admin juga memiliki pintasan Kelola Program. Menu pengelolaan ini tidak ditambahkan pada Bendahara, mentee, Mentor atau Asmen. Seluruh halaman ERP lain, logo, font, warna, hero dan motion tetap memakai proyek asal.

## Yang dapat dicoba

1. Buat cohort dengan nama dan tanggal program.
2. Tambahkan akun lokal: nama, email, peran dan status. Mentee juga memiliki track dan pathway dari Modul Draft 4. Email ganda, pathway di luar track dan penempatan kelompok yang salah ditolak.
3. Tambah/edit kelompok, tetapkan Mentor dan Asmen dari cohort yang sama, lalu tempatkan mentee melalui Edit akun. Kelompok ditandai lengkap sesuai struktur lama: satu Mentor, satu Asmen, lima mentee pada track yang sama.
4. Gunakan pencarian/filter peran, track dan kelompok. Buka Progres mentee untuk melihat jumlah catatan Mentoring, status kontrak, hasil KPI, publikasi raport dan aktivitas terakhir. Tidak ada persentase progres atau nilai yang dikarang.
5. Buka detail peserta. Halaman pengelolaan menampilkan metadata/status/waktu dan jumlah versi/pemeriksaan; isi jawaban pribadi atau bukti tidak ditampilkan.
6. Pada detail mentee, **Buka Mentoring mentee · lokal** membuka formulir Mentoring yang sudah ada. Simpan draft atau ajukan catatan, lalu gunakan **Kembali ke pengelola lokal**. Ringkasan progres menggunakan catatan lokal yang sama dan bertahan setelah muat ulang.

Penambahan/edit akun, cohort dan kelompok tercatat pada tab Riwayat. Perubahan dari tab browser lain memunculkan konflik revisi sebelum penyimpanan; isian tidak dihapus. Kegagalan localStorage tidak menghasilkan pesan berhasil dan tidak menimpa data sebelumnya. ID memakai UUID acak, waktu ditampilkan Asia/Jakarta. Domain perhitungan penilaian tidak diubah.

## Batas versi ini

Semua penambahan akun dan catatan hanya disimpan pada **browser dan origin preview lokal**. Tidak ada akun Auth produksi, kata sandi, email, tautan aktivasi, atau notifikasi yang dibuat. Mode pengelola lokal dan simulasi mentee adalah cara mencoba UI, bukan autentikasi atau otorisasi server. Data bukan penyimpanan lintas pengguna/perangkat. Jangan menganggap pemilihan peran lokal sebagai hak akses produksi.

Halaman pengelolaan menolak operasi lokal jika tidak dibuka pada hasil build lokal. Builder hanya mengganti salinan API/session di output terisolasi; API, konfigurasi dan layanan Supabase proyek utama tetap utuh. Tidak ada SQL, migrasi, Edge deployment, push GitHub, merge atau deploy yang dilakukan untuk perubahan ini.

Sebelum produksi perlu menghubungkan formulir dengan layanan akun yang sudah ada serta menyediakan ringkasan progres melalui server yang memeriksa izin pengelolaan cohort. Pengurus/pengelola tidak otomatis diberi akses jawaban pribadi atau kewenangan menilai. Pemilihan semua peran pada versi lokal tidak bermakna pemberian hak akun produksi. Kebijakan 360 dan keputusan P1 yang tertunda dari revisi sebelumnya tetap tidak berubah.

## Menjalankan kembali

```sh
python tools/build.py
python tools/build_local_management.py
```

Output `.local-management/` diabaikan Git. Sajikan direktori tersebut sebagai root server statis. Entry `index.html` membuka `app/kelola-program.html`. Untuk lingkungan Work Mode, set `.openai/hosting.json` ke `{"static":{"directory":".local-management"}}`, lalu `sites-preview start /workspace/scratch/456d7a2a9c7d/project`.

`python tools/build_local_management.py --qa` membuat salinan `/qa/` dengan namespace penyimpanan berbeda. Hanya salinan ini yang dipakai saat tes browser membuat cohort/akun/catatan bertanda QA; preview utama tetap kosong. Jangan deploy kedua output tersebut.

## Hasil verifikasi

59 tes lulus: regresi ERP dan penilaian, persistensi metadata akun, validasi email/track/pathway/kelompok, batas lima mentee, edit dengan ID tetap, idempotensi catatan, pemisahan peserta/cohort, konflik revisi, kuota/corrupt storage tanpa reset, form akun dengan isian terjaga ketika gagal, dan detail progres tanpa jawaban pribadi.

Browser memverifikasi: buat cohort → tambah mentee → pilih track/pathway → buka alur Mentoring → simpan draft → kembali ke pengelola → progres satu catatan Draft tetap muncul setelah muat ulang. Jawaban pribadi pengujian tidak tampil pada dashboard. Desktop dan konten pada iframe 360 px diperiksa; lebar konten 345 px sama dengan scrollWidth (sisa lebar untuk scrollbar). Reduced motion dipertahankan melalui CSS. Kontrol Navbar asli pada layar kecil tetap mengikuti perilaku proyek sebelumnya.
