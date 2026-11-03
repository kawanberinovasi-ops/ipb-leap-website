> Versi GitHub kini memakai akun bersama dan Supabase. Lihat [integrasi produksi 3 November 2026](INTEGRASI-PENGELOLA-ABSENSI-2026-11-03.md). Dokumen ini tetap menjelaskan build lokal yang terpisah.

# Mobile dan scan absensi — versi lokal

## Alur dan lokasi

- Pengurus/pengelola: **Program → Scan Absensi**, atau tombol Scan absen pada Kelola Akun & Progres.
- Buat kegiatan Common Class, Mentoring atau Event dengan waktu buka/tutup dalam WIB dan daftar mentee peserta. Tidak otomatis menambahkan peserta contoh.
- Pilih kegiatan, kemudian baca QR kartu mentee melalui kamera, foto, atau kode cadangan. QR yang terverifikasi menghasilkan satu catatan Hadir untuk pasangan kegiatan + mentee.
- Mentee: **Program → Kehadiran saya**. QR dibuat dari token acak yang disimpan di SQLite; tidak memuat nama/email atau menjadi token login.
- Detail mentee dan tabel Progres mentee pada pengelolaan membaca kehadiran dari database yang sama. QR dan riwayat mentee dapat dibuka melalui detail peserta lokal.

Tampilan pengelolaan, scanner dan kartu kehadiran disesuaikan untuk HP: satu kolom, kolom input minimal 16 px, tombol sentuh, daftar peserta berupa kartu, dan menu yang membungkus tanpa memotong tombol akun. Logo, font, warna dan komponen proyek dipertahankan; reduced motion tetap dihormati.

## Penyimpanan yang benar-benar berjalan

`tools/local_attendance_server.py` menjalankan server HTTP lokal dan SQLite. Paket yang dibagikan menyertakannya sebagai `jalankan.py`. Jalankan `python3 jalankan.py`, lalu buka `http://localhost:8767/app/kelola-program.html`. Server `python3 -m http.server` sebelumnya hanya menyajikan file; tidak dapat menyimpan absensi ke SQLite.

Database dibuat di `data-lokal/kehadiran.sqlite3`. Daftar akun/cohort yang sudah ada di localStorage disambungkan sebagai metadata registrasi: ID, nama, peran dan status aktif. Email, jawaban ABC, bukti dan nilai pribadi tidak dikirim ke database kehadiran. ID akun lama dipertahankan. Setiap browser/namespace mempunyai registry terpisah; tidak ada klaim sinkronisasi akun lintas perangkat.

Tabel lokal: registries, cohorts, profiles, enrolments, cards, attendance_events, participants, attendance, attendance_history. Foreign key aktif. Transaksi `BEGIN IMMEDIATE` dan unique `(event_id,user_id)` mencegah scan ganda, termasuk dua permintaan serentak. Scan ulang yang sudah Hadir mengembalikan catatan lama tanpa mengubah waktu/riwayat. Kartu tak dikenal, mentee nonaktif, cohort/peserta salah, serta kegiatan yang belum dibuka/sudah ditutup ditolak. Permintaan ulang pembuatan kegiatan hanya diterima jika isinya sama.

Belum scan tetap **Belum tercatat**, tidak otomatis Absen. Pengurus dapat mencatat/mengoreksi Hadir/Izin/Absen dengan alasan, revisi yang sesuai, operator lokal, waktu dan riwayat sebelumnya. Scan tidak menimpa Izin/Absen. Tidak ada perubahan rumus atau bobot penilaian; kehadiran tidak otomatis menjadi nilai P1.

## Kamera dan batas integrasi

Kamera hanya dibuka melalui tombol, tanpa audio, dan dihentikan saat berpindah, halaman disembunyikan, atau proses scan selesai. Membaca foto terjadi di perangkat; server hanya menerima isi kode. HTTPS atau localhost diperlukan untuk kamera langsung. Pada HTTP LAN atau izin kamera ditolak, tersedia foto/kode cadangan.

Versi ini **server lokal untuk satu operator**, bukan sistem autentikasi multiuser. Cookie HttpOnly SameSite, token CSRF, pemeriksaan origin/host, dan binding localhost melindungi operasi lokal dari halaman lintas origin. Pilihan peran demo bukan otorisasi server produksi. Server tidak disiapkan untuk dibuka ke jaringan umum. Integrasi Supabase produksi memerlukan autentikasi dan penugasan pengurus, RLS/RPC khusus, kartu yang terikat akun nyata dan HTTPS; belum diterapkan. Database produksi hanya diperiksa read-only dan tidak memiliki tabel kehadiran aktif. Tidak ada migrasi, reset, akun produksi, push, merge atau deploy untuk perubahan ini.

QR contoh pada halaman profil lama tidak dijadikan dasar kehadiran. Gunakan QR nyata pada menu Kehadiran saya untuk percobaan ini. Seluruh modul ERP lama tetap tersedia.

## Verifikasi

- 61 tes Node lulus, termasuk regresi ERP/penilaian, QR yang dibuat dibaca kembali oleh decoder asli, serta jalur penghentian kamera dan pembacaan foto lokal.
- 7 tes Python menggunakan SQLite sementara dan server HTTP: persistensi setelah buka ulang, scan serentak tanpa duplikat, kartu/peserta/cohort salah, kegiatan tertutup/masa depan, koreksi dengan alasan, konflik revisi, akun nonaktif, foreign key, kepemilikan registry, serta penolakan request tanpa cookie/CSRF atau dengan origin asing.
- Browser QA terpisah: buat cohort/mentee → kegiatan → QR mentee → pencatatan kode QR → Hadir di rekap pengurus → Hadir pada detail/progres dan halaman mentee setelah muat ulang. Scan ulang tidak menambah catatan. Data QA tidak masuk paket.
- Kamera fisik dan perangkat HP nyata belum dipakai. Pengujian QR meliputi decoder piksel nyata dan jalur kode cadangan melalui UI. Lebar 360 px diperiksa melalui iframe browser; bukan klaim uji semua tipe HP.

Dependensi QR dipin dan disertakan beserta lisensi pada `src/assets/attendance/vendor/`; tidak memerlukan CDN saat scan.
