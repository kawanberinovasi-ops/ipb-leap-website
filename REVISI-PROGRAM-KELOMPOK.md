# Revisi Program dan Kelompok — 29 Oktober 2026

Perubahan ini memakai LMS yang ada dan alur Simulasi-Kelompok-12-Bulan-IPB-LEAP.html. Tidak ada perubahan SQL, konfigurasi Supabase, rumus, bobot, ambang, pembulatan, atau kebijakan pengamat.

## Lokasi
- Mentee / Program: Progres, Mentoring, Personal Outcome Contract, Hasil KPI, Raport.
- Asmen / Kelompok: Mentoring (Catat Sesi lama), Review, Monitoring, Penilaian.
- Mentor / Kelompok: Mentoring, Review POC, Monitoring, Penilaian.
- 360-Degree Assessment: Self-Awareness, Critical Thinking, Communication, Collaboration, Execution, Ethics. Label Inggris, urutan dan data kompetensi lama dipertahankan.

Mentoring mentee menyimpan Worksheet ABC pada record `mentoring` yang sudah ada: insight = Awareness, decision = Best Step, action = Commitment. Tidak membuat salinan record ABC. Catatan lama tetap terbaca. Konfirmasi Mentor tetap menggunakan `mentoring_check`. Data detail sesi mengikuti bentuk Catat Sesi. Jadwal dipilih dari session yang sudah tersedia. Draft dan pengajuan menggunakan API, revisi, identitas pemeriksa, serta riwayat yang sama.

## Yang belum aktif di produksi
Ini perubahan branch untuk review, belum merge atau deploy. Supabase/Edge Function dan SQL tidak diubah atau dijalankan. Pengujian penyimpanan menggunakan layanan uji terisolasi; belum diverifikasi dengan akun produksi. Kendala CORS GitHub pada layanan aktif dari pemeriksaan sebelumnya tetap memerlukan integrasi terpisah.

Halaman Catat Sesi Asmen mempertahankan prototype lama, termasuk interaksi lokalnya. Halaman tersebut belum merupakan penyimpanan sesi lintas pengguna. Pengumpulan pengamat 360 belum diaktifkan; jumlah/jenis pengamat dan anonimitas menunggu keputusan. Tidak ada rumus atau skor 360 baru. Keenam level akhir tetap memakai field leadership pada review dan perhitungan P3 yang sama.

North Star dan pathway ditampilkan dari acuan Draft 4, dengan pathway mentee berasal dari enrolment aktif. KPI dan batas target yang sudah tersimpan dalam POC tidak ditimpa atau diganti oleh contoh.

## Validasi
41 tes lulus: alur draft/pengajuan/perbaikan, versi/konflik, izin peran, publikasi, periode M3/M6/M9/M12, sumber berubah, P3 tanpa hitung ganda, record mentoring tunggal setelah muat ulang, menu baru, dan regresi desain/modul lainnya. SQL test memakai database sementara; tidak dijalankan di database aktif.
