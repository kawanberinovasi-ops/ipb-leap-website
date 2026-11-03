# Integrasi pengelolaan program dan absensi — 3 November 2026

Tampilan pengelolaan dan scan dari versi lokal dipakai kembali pada website GitHub. Landing page, identitas visual, navigasi asli, modul lain, serta rumus penilaian dipertahankan. Pita **MODE LOKAL** hanya disuntikkan oleh build lokal, tidak dimuat pada build GitHub.

## Menu dan fungsi

| Pengguna | Menu | Fungsi produksi |
| --- | --- | --- |
| Pengurus/Pengelola yang ditugaskan | Program → Kelola Akun & Progres | Akun peserta dalam cohort, track/pathway, kelompok, ringkasan status Mentoring/kontrak/aktual dan raport terbit |
| Pengurus/Pengelola yang ditugaskan | Program → Scan Absensi | Kegiatan, daftar peserta, kamera/foto/kode QR, koreksi beralasan, penutupan presensi dan riwayat |
| Mentee | Program → Kehadiran saya | Kartu QR dan riwayat milik sendiri |
| Super Admin | Sistem → Kelola Akun & Progres | Metadata pengelolaan dan pembuatan cohort melalui kewenangan yang sudah ada |

Pengurus hanya dapat membuat akun Mentee, Mentor dan Asmen dalam cohort yang dikelolanya. Penambahan peran pengelola/keuangan tetap oleh Super Admin. Fungsi ini tidak menambah kewenangan membaca jawaban pribadi atau menilai. Scan memerlukan peran Program dan penugasan `can_manage` pada cohort; Super Admin dan Bendahara tidak otomatis menjadi operator presensi.

## Akun bersama

- Memakai Supabase Auth dan sesi LMS yang sama (`ipbleap.auth.v1`). Tidak ada akun login kedua.
- Akun baru langsung memiliki identitas dan enrolment, tetapi login belum aktif sampai pemilik menyelesaikan aktivasi.
- Setelah Simpan, pengelola memperoleh tautan pribadi sekali pakai, berlaku 14 hari. **Email tidak dikirim otomatis.** Bagikan tautan secara pribadi.
- Akun yang belum aktif memiliki tombol Aktivasi untuk menerbitkan tautan pengganti. Tautan sebelumnya dibatalkan.
- Pemilik menentukan kata sandinya sendiri. Pengelola tidak melihat atau menetapkan kata sandi peserta.
- Setelah aktivasi, kelompok dapat ditetapkan melalui Edit akun. Nama dan email login mengikuti identitas bersama; editor penempatan hanya mengubah enrolment/track/pathway/kelompok/status di cohort.
- Cohort baru dibuat oleh Super Admin, dimulai pada tanggal pertama bulan M1 selama 12 bulan. Penugasan pengelola cohort tetap melalui kewenangan sistem yang sudah ada.

## Data dan akses

| Jalur | Penyimpanan | Batas |
| --- | --- | --- |
| Build GitHub `docs/` | Supabase yang sudah digunakan LMS | Identitas diverifikasi; otorisasi dan revisi diperiksa server |
| Build lokal `.local-management/` | Akun/progres pada browser; kehadiran SQLite lokal | Operator lokal tepercaya; bukan autentikasi produksi |
| QA lokal `.local-management/qa/` | Namespace dan registry terpisah | Tidak masuk build GitHub dan tidak diimpor ke produksi |

Tidak ada impor otomatis data lokal, reset akun, penggantian config, atau seed peserta/nilai/kegiatan/kehadiran pada produksi. Koneksi lokal tetap tersedia melalui server Python. Server SQLite tidak dibutuhkan untuk website GitHub.

Ringkasan progres menggunakan endpoint metadata khusus. Tidak ada isi jawaban, bukti, sumber publikasi atau jawaban pengamat dalam respons pengelolaan. Nilai hanya berasal dari publikasi penilai. Kehadiran tidak otomatis menghasilkan skor atau mengubah P1.

## Backend yang diterapkan

Migrasi tambahan `integrate_program_management_attendance` hanya memuat dua file berikut, secara berurutan:

1. `backend/erp/integrations/management-attendance.sql`: endpoint metadata/penempatan dan tabel presensi baru.
2. `backend/erp/integrations/managed-accounts.sql`: ekstensi layanan aktivasi akun untuk pengelola cohort.

Edge Function `erp-account` versi 3 memakai sumber `backend/erp/functions/account.ts`, mempertahankan aktivasi lama dan menambahkan CORS GitHub Pages serta kewenangan cohort untuk pembuatan akun peserta. Token pengguna diverifikasi di dalam fungsi. Service role tetap hanya di server. Pengumpulan 360 pada `pending/360.sql` tidak diterapkan.

Tabel presensi memakai RLS dan pencabutan akses tabel langsung; akses dilakukan melalui RPC berotorisasi. Pemeriksaan advisor menghasilkan INFO "RLS Enabled No Policy" karena akses tabel langsung memang ditutup. Peringatan pengaturan leaked-password protection sudah ada sebelum integrasi; konfigurasi Auth tidak diubah dalam pekerjaan ini.

## Validasi

- 68 pengujian Node dan 7 pengujian Python lulus, termasuk aturan penilaian lama, pembatasan peran, metadata tanpa jawaban, konflik revisi, aktivasi, scan idempoten, roster, koreksi, penyimpanan SQLite dan pembacaan QR nyata.
- Uji UI produksi terisolasi memeriksa tautan aktivasi, pilihan peran pengelola, tidak adanya simulasi menyamar sebagai mentee, dan isian yang tetap tersedia saat konflik.
- Browser QA lokal: buat cohort/akun/kegiatan, tampilkan QR mentee, catat Hadir dari kode QR, dan muat ulang. Halaman pengelolaan dan scan pada viewport 360 px tidak meluap horizontal.
- Seluruh halaman publik dibandingkan byte demi byte dengan versi asli; modul ERP lain dan kesamaan domain penilaian frontend/backend tetap diperiksa.
- Produksi: RPC menolak akses anonim (401/42501); preflight `erp-account` dari origin GitHub mendapat 204, dan pembuatan akun tanpa sesi mendapat 401.
- Jumlah profil/cohort/enrolment/catatan produksi tetap 2/1/1/0 setelah migrasi; kegiatan dan kehadiran baru mulai kosong.

**Batas pengujian:** belum melakukan login, membuat akun, aktivasi, dan scan menggunakan akun produksi nyata. Tidak ada kredensial produksi yang dipakai untuk QA. Kamera fisik di HP memerlukan pemeriksaan pengguna pada HTTPS dengan izin kamera. Tes server memakai PostgreSQL terisolasi, sedangkan tes browser operasional memakai penyimpanan lokal terpisah.
