# GROW Canvas IPB LEAP — versi lokal

Versi lokal untuk meninjau alur baru sebelum perubahan produksi. Situs publik, akun, penugasan, dan database IPB LEAP tidak diubah.

## Buka

Klik dua kali `MULAI-LOKAL.command`, kemudian buka http://127.0.0.1:8765/app/grow-canvas.html. Terminal perlu tetap terbuka selama pratinjau digunakan. Jika port tersebut sedang dipakai, jalankan `python3 local/server.py --port 8767` dari folder ini dan buka alamat dengan port 8767.

Pilih Mentee, Asmen, atau Mentor melalui kontrol **Tampilan** di bagian atas. **Track uji** memiliki ruang data lokal terpisah untuk setiap track. Seluruh ruang pengguna dimulai kosong, tanpa akun, mentee, kelompok, catatan, atau nilai fiktif. Pilihan role adalah simulasi untuk pengujian, bukan autentikasi atau pengamanan akses nyata. Pratinjau hanya melayani alamat loopback komputer ini.

## Semua halaman lokal

- Mentee, form langsung terbuka: http://127.0.0.1:8765/app/mentoring.html?role=mentee&track=social
- Asmen, detail sesi dan kehadiran: http://127.0.0.1:8765/app/catat-sesi.html?role=asmen&track=social
- Mentor, detail sesi dan kehadiran: http://127.0.0.1:8765/app/catat-sesi.html?role=mentor&track=social

Menu mentee: GROW Canvas, Catat Mentoring, Raport. Menu Asmen/Mentor: Kelompok, Review GROW, Review Catatan Mentee, Raport. Progres/bukti, pemeriksaan Asmen, penilaian milestone, dan hasil terbit berada pada halaman Raport yang sama. Catat Sesi pendamping tetap dibuka dari Kelompok. Tautan lama Progres, Monitoring, dan Penilaian juga membuka halaman Raport gabungan. Bentuk form penilaian juga terlihat saat target belum tersedia, dengan penyimpanan review dinonaktifkan sampai ada target yang disepakati.

## Alur mencoba

1. **Mentee — GROW Canvas:** isi G/R/O/W, pilih KPI, baseline, cara ukur, dan milestone M3/M6/M9/M12. Tuliskan dukungan yang dibutuhkan dari Mentor di Reality. Simpan draft atau ajukan.
2. **Asmen — Review GROW:** periksa kelengkapan, lalu pilih Perlu perbaikan atau Siap dibahas Mentor. Permintaan perbaikan dapat ditanggapi mentee dengan versi baru.
3. **Mentor — Review GROW:** sepakati arah atau minta perbaikan. Tanggapi kebutuhan di Dukungan Mentor. Tanggapan dapat dibaca mentee.
4. **Asmen/Mentor — Catat Sesi Mentoring:** form terpisah untuk sesi kelompok/1-on-1, nomor, tanggal, durasi, tema kosong opsional, format, topik, peserta/kehadiran, ringkasan, tindak lanjut, serta tautan dokumentasi/materi. Sesi dapat disimpan sebagai draft atau tercatat tanpa menunggu GROW. Daftar peserta lokal diisi manual, tidak mengambil nama atau penugasan produksi. Riwayat versi sesi disimpan.
5. **Mentee — Catat Mentoring:** isi apa yang didapat, action berikutnya, dan tenggat. Tanggal pertemuan otomatis hari ini dan bisa disesuaikan. Kebutuhan bantuan per pertemuan bersifat opsional. Detail sesi langsung tampil: jenis sesi, sesi ke, tanggal, jam WIB, tema kurikulum, format, dan topik. Tiga isian hasil mentoring tetap berada di bawah detail sesi, tanpa tombol tambah dan tanpa menunggu GROW disepakati. Sesi tercatat pendamping dapat dipilih sebagai rujukan (opsional); catatan juga boleh berdiri sendiri. Jika GROW belum disepakati, catatan tidak dianggap otomatis merujuk ke target yang belum disepakati. GROW tetap diperlukan untuk penilaian milestone.
6. **Mentee — Raport / Tindak lanjut & Bukti:** laporkan action sebelumnya, status, hasil/hambatan, tanggal selesai, dan bukti bila tersedia. Tidak perlu menulis ulang GROW.
7. **Asmen — Raport / Tindak lanjut & Bukti:** beri poin pelaksanaan, waktu, dan hasil/bukti setelah action selesai atau melewati tenggat. Action yang menunggu belum dinilai, bukan nol.
8. **Mentor — Raport / Penilaian milestone:** pilih M3/M6/M9/M12, baca target, catat aktual/bukti, pilih tingkat capaian, serta tulis alasan. Setelah sumber lengkap, terbitkan raport lokal.
9. **Mentee — Raport:** baca hasil yang diterbitkan. Kartu raport terbit hanya menampilkan total nilai /100; rincian sumber Asmen/Mentor tetap dipakai dalam proses penilaian. Raport lama menyimpan versi target, sumber, dan nilai saat diterbitkan. Perubahan hasil akan membatalkan pemeriksaan/review aktif yang sudah tidak sesuai, tanpa mengubah raport lama.

## KPI dan North Star

KPI ditranskripsikan dari gambar **Tangkapan Layar 2026-11-04 pukul 10.26.30.png**: 16 pilihan dalam lima kelompok. Target M12 menggunakan teks sumber, sedangkan milestone M3/M6/M9 direncanakan bersama Mentor. Tidak semua KPI diwajibkan dipilih. North Star mengikuti kode situs sebelumnya secara persis.

Nama kelompok KPI pada gambar dipetakan untuk pratinjau sebagai berikut:

| Kelompok KPI gambar | Identitas track sebelumnya | North Star tetap |
|---|---|---|
| Entrepreneur | Entrepreneur / Business | Rp500 juta Cumulative Annual Revenue |
| Professional / Industri | Professional / Corporate / Bureaucracy | 1 Career Breakthrough |
| Akademisi & Riset | Academic & Research | 1 Academic Breakthrough |
| Birokrasi & Politik | Politics / Public Leadership | 1 Political Breakthrough |
| Sosial & Komunitas | Social & Community / Social Impact | 1 Sustainable Impact |

Tidak ada pemindahan track peserta asli. Sebelum integrasi produksi, perbedaan pengelompokan Birokrasi antara katalog lama dan gambar perlu dipastikan. Untuk KPI artikel populer, sumber tidak merinci apakah 1.000 pembaca dihitung per artikel atau gabungan; cakupannya perlu ditulis pada cara ukur bersama Mentor.

## Skema poin yang diuji

- Asmen: pelaksanaan 0/5/10, waktu 0/5/10, hasil/bukti 0/5/10. Rata-rata action yang selesai atau lewat tenggat pada periode tersebut, maksimal 30. Semua action yang layak dinilai perlu diperiksa. Kosong/belum diperiksa bukan nol.
- Mentor: tiap KPI dipilih 0/25/50/75/100 terhadap milestone periode. Rata-rata capaian dikalikan 70%, maksimal 70. Aktual dan alasan wajib; nilai positif perlu bukti atau uraian bukti yang diperiksa.
- Total: Asmen + Mentor, maksimal 100. Kedua sumber harus lengkap sebelum raport lokal diterbitkan.
- Ini **skema uji**, bukan perubahan bobot, aturan kelulusan, atau kewenangan penilaian produksi. Terbit per periode dapat dicoba tanpa menunggu akhir kalender dalam simulasi ini. Patokan rinci tingkat capaian, kelayakan perubahan tenggat, penilai akhir M12, dan hubungan dengan penilaian kepemimpinan/360 masih keputusan program sebelum peluncuran.

## Lingkup perubahan

Frontend utama: menu Program dan Kelompok, GROW Canvas, Catat Mentoring, Progres/Monitoring, Penilaian, dan Raport. Beranda mentee menggunakan kartu/animasi asli, dengan pintasan dan nilai dari alur GROW lokal. Logo asli tetap digunakan. Halaman publik dan modul operasional lainnya disertakan sebagai referensi sebelumnya; integrasi produksi di halaman tersebut tidak diaktifkan untuk simulasi.

Backend lokal: Python + SQLite pada `data/grow.sqlite3`; menyimpan sesi pendamping dan riwayatnya, kehadiran, draft, pengajuan, pemeriksaan, kesepakatan, action, tanggapan bantuan, review, snapshot raport, dan audit. Konflik versi ditolak. Koneksi browser ke layanan eksternal dibatasi oleh CSP. Tidak ada klien Supabase pada alur GROW lokal.

Ini belum merupakan backend produksi multi-pengguna. Integrasi berikutnya memerlukan migrasi terpisah, hak akses dari sesi akun asli/penugasan, validasi server, pengaitan data historis, dan pengujian akses. Pilihan role pratinjau tidak boleh dijadikan dasar otorisasi produksi. Data ABC/POC lama tetap berada pada sumber sebelumnya; tidak dikonversi atau dihapus.

## Berkas dan pemeriksaan

- `src/assets/grow/`: tampilan, konteks pratinjau, katalog KPI.
- `local/model.py`: transisi alur, validasi, nilai, audit/snapshot.
- `local/server.py`: server loopback dan API lokal.
- `tools/build.py`: membangun `docs/` dari template lokal.
- `tests/test_workflow.py`: 15 pengujian model, termasuk batas role, draft privat, katalog, transisi, konflik versi, nilai nol, sumber berubah, dan snapshot raport.

Jalankan pemeriksaan dengan `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v`. Pengujian browser memakai database terpisah di folder sementara. Data uji tidak masuk ruang pengguna di port 8765.

## Latihan penilaian yang langsung bisa dicoba

Pada kontrol pratinjau, klik **Coba alur penilaian**. Tautan langsung: http://127.0.0.1:8765/app/raport.html?role=asmen&track=social&period=3&demo=assessment

Mode ini menggunakan `data/assessment-practice.sqlite3`, terpisah dari isian pengguna. Kasus sosial M3 sudah memiliki GROW disepakati, target 100 penerima manfaat, laporan 75 orang terverifikasi, dan satu action selesai tepat waktu. Nilai awal kosong agar pengguna dapat memberi nilai sendiri. Tanggal latihan tetap 4 November 2026. Data contoh hanya muncul dengan parameter `demo=assessment`; nilai dan raport latihan tersimpan saat server dimulai ulang. Tombol kembali membawa pengguna ke ruang isian biasa.

1. Asmen: pilih pelaksanaan 10, waktu 10, hasil/bukti 5, isi alasan, simpan → 25/30.
2. Gunakan tombol **Coba sebagai Mentor**: contoh aktual dan uraian bukti sudah tersedia; pilih capaian 75%, isi/sesuaikan alasan, simpan → 52,5/70.
3. Terbitkan raport latihan → 77,5/100. Gunakan tombol **Lihat sebagai Mentee** untuk membaca hasil.

Pengguna bebas mengganti pilihan dan menyimpan ulang. Perhitungan sementara tampil di bawah form sebelum disimpan. Mekanisme dan bobot tetap skema usulan lokal yang sama, belum keputusan produksi. Pengujian `tests/test_demo.py` memeriksa pemisahan data, nilai, penerbitan, dan seed yang tidak menimpa hasil latihan.
