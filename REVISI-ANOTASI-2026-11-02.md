# Revisi 15 anotasi Program — 2 November 2026

## Perubahan yang diterapkan

- Program langsung membuka Progres, Mentoring, Personal Outcome Contract, Hasil KPI atau Raport. Baris tab modul yang berulang di dalam halaman dihapus; konteks cohort, kelompok, mentee, periode dan sumber tetap dibawa.
- Progres menjelaskan check-in fleksibel bersama Asmen. Tidak ada formulir laporan check-in baru yang terpisah. Ringkasannya opsional pada hasil Mentoring untuk dibahas bersama Mentor. Laporan check-in dan pemeriksaan lama tetap dapat dibuka.
- Mentoring mentee mempertahankan detail sesi dan Worksheet ABC. Pilihan sesi terjadwal dihapus, Common Class ditambahkan, dan Durasi diganti Jam (WIB). Data durasi dan referensi sesi lama tetap disimpan. Penyimpanan memakai record mentoring, versi, revisi dan API yang sama.
- Personal Outcome Contract ditulis lengkap. Pathway berasal dari enrolment aktif; hasil akhir dan kondisi sekarang menjadi isian terpisah. KPI dipilih dari katalog track Modul Draft 4, slide 17, 19, 22, 25 dan 28. Server memeriksa track/pathway untuk kontrak format tersebut, termasuk jika penanda versi kurikulum dihapus dari request.
- Mentee mengisi milestone M3/M6/M9/M12. Patokan Progress/Achieve/Exceed tetap memakai aturan lama, disepakati Mentor pada pemeriksaan kontrak dan disimpan di data pemeriksaan yang sudah tersedia. Jawaban mentee tidak diubah pemeriksa; versi kontrak yang disepakati dibaca bersama kalibrasi pemeriksa untuk perhitungan. Patokan lama tidak dihapus saat formulir menyimpan versi baru.
- Kartu nilai beranda membaca publikasi review milik mentee dari Program. Nilai terbaru, riwayat periode, P1 dan P2 memakai publikasi aktual; draft dan nilai peserta lain diabaikan. Tanpa publikasi, tampil tanda kosong. Grade huruf/bulan contoh dihapus karena bukan hasil aturan penilaian Program.
- Chat, badge chat, dan Task disembunyikan dari topbar. Halaman/modulnya tetap ada. Logo, font, warna, hero, login, komponen dan motion tetap memakai proyek asal.

## Backend dan data

Edge Function `erp-records` diperbarui dari versi 3 menjadi versi 4, dengan `records.ts`, `domain.mjs`, `curriculum.mjs` dan `sources.mjs`. Origin GitHub Pages diizinkan; autentikasi tetap diverifikasi dengan Auth getUser sebelum RPC penulisan. Status verify_jwt lama dipertahankan karena fungsi melakukan autentikasi sendiri.

Tidak ada SQL/migrasi yang dijalankan, tabel baru, perubahan RLS/peran, akun baru, reset, atau data operasional contoh. Katalog dan domain frontend/backend identik. Bobot, rumus, ambang level, pembulatan, kewenangan dan persyaratan publikasi tidak diubah. Data tambahan memakai JSON pada versi/pemeriksaan yang sudah ada.

## Pengujian dan batas

51 tes lulus. Termasuk PostgreSQL sementara: kontrak milestone tanpa batas nilai → kalibrasi Mentor → jawaban asli tetap utuh → aktual/bukti → publikasi; Common Class tanpa session terjadwal; penolakan pemeriksaan Mentor oleh Asmen; draft/pengajuan/perbaikan; konflik; sumber berubah; akses per peran dan riwayat. Tes DOM memeriksa isian yang tidak hilang saat gagal dan penyimpanan melalui muat ulang fixture. Tes regresi memeriksa halaman publik, desain shell dan modul lain. Browser lokal terisolasi memeriksa formulir pada desktop dan iframe 360 px serta kartu nilai kosong. Fixture tidak masuk deployment.

Backend produksi versi 4 diverifikasi aktif, seluruh file deployment dibaca ulang, preflight origin GitHub menghasilkan 204 dan POST tanpa akun menghasilkan 401. Belum ada pengujian menulis dengan akun produksi pengguna; hasil tes penyimpanan lintas peran berasal dari PostgreSQL dan layanan uji terisolasi, bukan klaim bahwa pengguna nyata sudah menyelesaikan workflow produksi.

**Keputusan P1 masih diperlukan:** aturan lama mensyaratkan dua jadwal check-in setiap bulan serta pemeriksaan Asmen. Menghilangkan kewajiban laporan mentee tidak otomatis menentukan cara menghubungkan check-in fleksibel yang dilaporkan saat mentoring dengan unit pemeriksaan P1. Rumus dan penyebut lama sengaja dipertahankan. Ringkasan mentoring tidak diberi warna/nilai otomatis; publikasi tetap ditolak jika sumber P1 belum lengkap. Diperlukan keputusan pengelola tentang pencatatan pemeriksaan fleksibel sebelum mengubah alur P1 tersebut.

Pengumpulan 360 tetap belum diaktifkan; jenis/jumlah pengamat dan anonimitas masih menunggu keputusan. Tidak ada skor 360 tambahan. Catat Sesi Asmen dan modul ERP lain tetap mempertahankan status integrasi masing-masing; tampilan prototype tidak menjadi klaim penyimpanan lintas pengguna. Tidak ada layanan email/notifikasi baru.
