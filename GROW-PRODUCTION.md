# GROW Canvas — integrasi aplikasi utama

GROW memakai identitas Supabase dan penugasan IPB LEAP yang sudah ada. Halaman latihan/prototype tidak digunakan sebagai aplikasi peserta. Source berada pada `src/assets/grow/`; migrasi baru terpisah dari tabel ABC/POC sebelumnya.

## Perilaku per akun

- Mentee mengisi tujuan awal, memilih KPI sesuai track penugasan, dan menetapkan milestone M3/M6/M9/M12. Catat Mentoring memuat detail sesi, pembelajaran, action, tenggat, dan dukungan yang dibutuhkan.
- Asmen yang ditugaskan memeriksa GROW serta proses setiap action: pelaksanaan, ketepatan waktu, dan hasil/bukti, masing-masing 0/5/10. Nilai periode merupakan rata-rata action yang sudah layak dinilai; kosong bukan nol.
- Mentor yang ditugaskan menyepakati GROW, menanggapi dukungan, menilai capaian setiap KPI terhadap milestone, dan menerbitkan raport periode ketika sumber lengkap. Capaian 0/25/50/75/100% dikalikan 70%; nilai Asmen maksimal 30.
- Mentee melihat total nilai dari raport yang sudah diterbitkan. Review yang belum diterbitkan tidak dibuka kepada mentee. Raport terbit hanya memuat satu total nilai /100 pada kartu utamanya.
- Penerbitan periode menunggu akhir milestone cohort. Snapshot terbit menyimpan target dan sumber saat terbit; perubahan hasil berikutnya membatalkan pemeriksaan/review aktif yang sudah usang tanpa menimpa snapshot tersebut.
- Raport GROW tidak mengubah status kelulusan maupun endpoint keputusan akhir tim penilaian sebelumnya.

Mentee dapat menambahkan beberapa KPI dari katalog track melalui tombol `+ Tambah KPI`. Masing-masing menyimpan baseline, cara ukur, dan empat milestone sendiri. Penambahan/penghapusan KPI mempertahankan isian KPI lainnya; KPI yang sama tidak bisa ditambahkan dua kali. Review Mentor wajib mencakup semua KPI terpilih dan poin Mentor memakai rata-rata capaian KPI.

Menu modul berada hanya pada dropdown atas. Mentee: GROW Canvas, Catat Mentoring, Raport. Pendamping: Kelompok, Review GROW, Review Catatan Mentee, Raport. Catat Sesi pendamping tetap menggunakan roster kelompok asli dan penyimpanan sesi yang sudah ada. Data ABC/POC lama tetap tersedia melalui tautan riwayat pada Kelompok; tidak dikonversi atau dihapus.

Selector role/track lokal dan mode latihan tidak dikirim ke aplikasi utama. Parameter `role`, `track`, atau `demo` pada alamat tidak memberikan kewenangan. Scope server memeriksa sesi aktif, profil, enrolment mentee, serta penugasan pendamping. Track berasal dari enrolment, bukan isian bebas atau metadata pengguna.

## Backend

Migrasi `supabase/migrations/20261104083341_grow_canvas_authenticated.sql` sudah diterapkan pada proyek IPB LEAP ERP. Versi lokal disesuaikan dengan versi yang tercatat pada history backend.

State dan audit snapshot berada pada `erp_private.grow_workspaces` dan `erp_private.grow_events`, berindeks per cohort/mentee. RLS aktif, akses tabel langsung ditolak, dan perintah melalui RPC authenticated dengan pemeriksaan sesi/penugasan. Wrapper publik memakai security invoker; fungsi berhak tinggi berada di schema private dengan search_path kosong dan grant execute eksplisit. Semua nilai dihitung di server. Penulisan memakai advisory lock dan pemeriksaan revision untuk menolak isian usang.

RPC: `erp_grow_state` dan `erp_grow_command`. Tidak ada service credential di browser, tidak ada akun baru atau seed data peserta.

## Verifikasi

- `npm test`: 101 pengujian lulus, termasuk alur SQL GROW, akses peran, draft privat, KPI palsu, skor, sumber berubah, publikasi, dan penolakan lintas mentee.
- Browser dengan PostgreSQL sementara: pengajuan mentee → pemeriksaan Asmen → kesepakatan Mentor → catatan → hasil action → poin Asmen → review Mentor → publikasi → readback mentee. Contoh perhitungan terisolasi 25 + 52,5 = 77,5.
- Backend terpasang: transaksi uji yang seluruhnya di-ROLLBACK meluluskan alur yang sama dan penolakan peran yang salah. Setelah rollback: profil tetap 126, workspace GROW 0, event GROW 0, akun sementara 0. Berkas verifikasi manual: `backend/erp/verification/grow-rollback-smoke.sql`.
- Akses anonim ke RPC ditolak; authenticated tidak dapat membaca/menulis tabel langsung; RLS kedua tabel aktif. Tidak ada data ABC/POC yang diubah.
- Browser pada iframe viewport 390 px: lebar dokumen 390 px, tanpa overflow; dropdown dan form mentee tetap tersedia. Bukti visual lokal berada di `.qa/` yang diabaikan Git dan tidak dipublikasikan.
- Halaman publik, logo, domain, login, dan penyimpanan sesi asli dipertahankan. Tidak ada data uji pada hasil build.

Advisor keamanan tidak menemukan temuan baru pada objek GROW. Temuan sebelumnya tetap sama: empat tabel absensi memakai default-deny tanpa policy ([penjelasan linter](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)), dan pengaturan [leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) belum aktif. Pengaturan Auth tersebut tidak diubah oleh integrasi ini.

## Publikasi dan pemulihan

Source: `kawanberinovasi-ops/ipb-leap-website`, build `/docs`. Hosting domain: `dickyadisaputrash2112-byte/ipbleap.com`, branch main pada root. Hasil build aplikasi dikirim ke hosting dengan domain OG URL `https://ipbleap.com/`; berkas publik dan CNAME hosting tidak ditimpa.

Jika perlu pemulihan, revert commit frontend pada hosting/source. Pertahankan tabel dan data GROW agar jawaban peserta tidak hilang. Jangan melakukan drop atau konversi data sebagai rollback tampilan. Hak penerapan yang digunakan berasal dari koneksi pemilik masing-masing repository.
