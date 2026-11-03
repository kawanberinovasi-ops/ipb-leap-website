# Revisi sembilan anotasi beranda, kalender dan Cari — 3 November 2026

| Anotasi | Implementasi |
| --- | --- |
| 1 · Sapaan | Beranda memakai nama terdaftar dari sesi akun LMS, tanpa nama contoh Nabila. |
| 2 · Kelompok | Label kelompok diturunkan dari nama Mentor yang ditugaskan. ID, anggota, penugasan dan nama historis di database tidak ditimpa. Jika belum ada penugasan, tampilkan keadaan kosong yang jelas. |
| 3 · Kehadiran | Tombol QR & Kehadiran saya tersedia langsung pada hero beranda; item duplikat di Program dihapus. |
| 4–5 · Chip hero | Chip Kelompok Rajawali dan Batch 2026 di hero mentee dihapus. |
| 6 · Event peserta | Tautan alat pengurus dihapus dari halaman Event peserta. Menu pengelolaan pengurus tetap tersedia. |
| 7 · Kalender | Sumber pribadi, kelompok sesuai Mentor dan kegiatan program berasal dari data tersimpan yang boleh diakses akun. Google Calendar tidak dianggap terhubung. |
| 8 · Informasi beranda | Teks berjalan membaca pengumuman pengurus yang disematkan, sudah waktunya terbit, dan sesuai penerima. Tidak ada pengumuman/jadwal contoh. |
| 9 · Cari | Klik, Ctrl+K dan Cmd+K membuka pencarian halaman sesuai peran, pengumuman dan jadwal terotorisasi. Mendukung filter, Escape dan pemulihan fokus. |

## Pengumuman benar-benar tersambung

Halaman Pengumuman yang sudah ada mempertahankan komponen pemilihan penerima, penulisan, pratinjau, jadwal, dan riwayat. Data penerima berasal dari cohort/kelompok/akun yang terdaftar. Pilihan kelompok memakai label Mentor yang sama dengan beranda dan kalender.

Pengelola cohort dapat menerbitkan ke seluruh cohort, peran tertentu, kelompok, atau orang yang terdaftar pada cohort tersebut. Server memeriksa peran, sesi aktif, penugasan cohort dan target. Pengumuman terjadwal baru terlihat setelah waktu terbit; tidak membutuhkan klaim pengiriman email. Tarik pengumuman memakai revisi agar tidak menimpa perubahan tab lain; isi dan riwayat penerbitan tetap tersimpan. Tombol Muat ulang mempertahankan draft yang sedang ditulis.

Peserta yang membuka Pengumuman membaca daftar yang ditujukan kepadanya, tanpa formulir penerbitan. Beranda menyematkan judul sesuai pilihan pengurus; tautan membuka isinya. Pencarian menggunakan sumber yang sama. Tidak ada statistik baca, notifikasi, email, atau push fiktif. Pengiriman email/push dan lampiran belum terhubung dan dinonaktifkan pada formulir.

## Kalender dan beranda

Kalender kelompok membaca jadwal `erp_sessions` yang sudah ada. Kalender program membaca kegiatan/roster presensi yang sudah tersedia. Jadwal pribadi dapat dibuat dan dibatalkan oleh pemilik; jadwal tersebut tidak dibuka kepada pengurus hanya karena perannya pengurus. Bulan/hari mengikuti waktu Asia/Jakarta, termasuk pergantian tanggal dari UTC. Filter sumber, pencarian kalender, pindah bulan, Hari ini, serta tampilan hari/minggu/bulan/agenda memakai data yang sama.

Kehadiran tetap dicatat lewat modul presensi; memilih jadwal atau membukanya tidak dianggap hadir. Kalender tidak membuat tautan Meet, sinkron Google atau mengirim pengingat secara pura-pura.

Kartu nilai beranda tetap bersumber hanya dari raport terbit. Daftar tindak lanjut membaca draft/permintaan perbaikan dari catatan program milik mentee. Jadwal terdekat membaca kalender yang terotorisasi. Kartu project dan materi tetap dipertahankan dengan penjelasan bahwa sumber data/progresnya belum terhubung.

## Backend tambahan

Migrasi yang diterapkan: `connect_portal_announcements_personal_calendar`, bersumber dari `backend/erp/integrations/portal-announcements-calendar.sql`.

Tiga tabel tambahan: pengumuman, riwayat pengumuman, dan jadwal pribadi. Semua memakai RLS, tanpa akses tabel langsung dari frontend. RPC `erp_portal_workspace` dan `erp_portal_command` melakukan pemeriksaan sesi, cohort, penerbit/pemilik dan revisi di server. Tidak ada reset atau migrasi data lokal. Tidak ada perubahan autentikasi, akun, jawaban penilaian, nilai, 360, maupun rumus.

Runtime komponen lama diperbaiki agar atribut boolean seperti `disabled`/`checked` mengikuti nilainya; string `false` tidak lagi dianggap aktif oleh browser. Loop native `template` dipakai untuk opsi select dan baris riwayat agar tidak hilang saat HTML tabel/select diparse. Versi aset aplikasi diperbarui supaya browser tidak memakai runtime lama dari cache. Halaman publik, logo, warna, font, hero, modul lain dan reduced motion dipertahankan.

## Validasi dan batas

- 78 tes Node + 7 tes Python lulus.
- Tes PostgreSQL terisolasi: penerbitan, jadwal masa depan, penerima peran/kelompok, penarikan, duplikasi, konflik revisi, penolakan peran lain/cohort lain, privasi kalender pribadi dan penolakan akses tabel langsung.
- Tes UI/model: nama terdaftar, label Mentor, pengumuman tersemat, batas waktu WIB, sumber kalender, filter Cari, shortcut, kegagalan koneksi, atribut boolean dan riwayat dalam tabel/select.
- Browser QA lokal: pengurus menerbitkan pengumuman → tetap tersimpan setelah muat ulang → judul muncul di beranda mentee → ditemukan lewat Cari. Jadwal pribadi dibuat dan tampil pada tanggal/jam yang benar. Beranda dan Kalender pada 360 px tidak meluap horizontal.
- Produksi: RPC anonim ditolak (401 / 42501); tabel pengumuman, riwayat dan jadwal pribadi mulai kosong. Profil tetap 2 dan catatan penilaian tetap 0; tidak ada data QA diimpor.

Belum menguji penerbitan atau jadwal melalui akun produksi nyata. Browser QA menggunakan namespace lokal terpisah; pengujian server memakai PostgreSQL sementara. Modul Event lain, project, materi, Google, email/push dan lampiran tidak diklaim terintegrasi hanya karena tampilannya tersedia.
