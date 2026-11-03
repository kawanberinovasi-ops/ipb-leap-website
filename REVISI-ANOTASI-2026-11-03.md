# Revisi tujuh anotasi — 3 November 2026

| Anotasi | Hasil |
| --- | --- |
| 1 · Hero login | Panel Make Your Leap/Workspace dihapus dari login LMS. Logo asli, formulir, warna, sesi dan aktivasi akun tetap digunakan. Landing page publik tidak berubah. |
| 2 · Banner PROTOTYPE | Pita global PROTOTYPE dihapus dari halaman LMS produksi melalui konfigurasi build. Build lokal tetap memberi penanda lokal yang terpisah. |
| 3 · Pemilih konteks | Akses akun dan Cohort dihapus dari isi halaman penilaian/program. Konteks cohort/mentee tetap diteruskan oleh tautan; pemilih mentee untuk pendamping tetap tersedia. |
| 4 · Bahasa KPI | Pilihan KPI seluruh track memakai label Inggris. Nilai pengenal KPI lama tetap dipakai agar jawaban dan riwayat tidak perlu dimigrasikan. Label KPI yang dikenal juga ditampilkan dalam Inggris saat dibaca. |
| 5 · Bantuan KPI | Kalimat bantuan yang ditandai di bawah pilihan KPI dihapus. |
| 6 · Pathway | Pathway kontrak menjadi pilihan dari track dalam Modul Draft 4. Teks penempatan lama yang tidak sesuai katalog tidak otomatis dijadikan pilihan valid. |
| 7 · Pengaturan | Pemilih pratinjau peran dihapus. Peran, nama, email, ID akun dan kelompok isian mengikuti akun terverifikasi; peran dari URL/penyimpanan tampilan yang tidak diberikan kepada akun diabaikan. |

## Pathway dan data lama

Pathway yang dipilih tersimpan sebagai bagian dari versi Personal Outcome Contract. Pemilik kontrak dapat memilih salah satu pathway yang tersedia untuk track akun. Pilihan diperiksa lagi di server; pathway track lain ditolak. Ini tidak mengganti track, enrolment, penugasan mentor atau nilai sebelumnya. Enrolment tetap dikelola oleh pengelola yang berwenang.

Daftar tetap mengikuti modul: Business → Validate/Grow; Academic → Produce/Advance; Professional → Career Acceleration/Career Transition; Politics → Community Leadership/Organizational Leadership/Policy / Public Initiative; Social → Implement/Strengthen / Scale.

Kontrak lama dan nilai KPI sebelumnya tetap tersimpan dalam riwayat. Pembaruan frontend/backend sama. Bobot, ambang, pembulatan, periode, kalibrasi Mentor, syarat publikasi dan perhitungan 360 tidak berubah. Tidak ada migrasi database atau perubahan akun pada pekerjaan ini.

## Batas Pengaturan

Identitas dan peran sudah mengikuti sesi LMS yang sama. Isian profil tambahan belum disambungkan ke penyimpanan akun; halaman dan tombol simpan menjelaskan batas tersebut. Nama/email/ID contoh dihapus dari identitas yang ditampilkan. Kartu mentee menuju halaman QR kehadiran yang sudah ada; pola QR dekoratif lama tidak dipakai untuk presensi. Status Google tidak mengklaim terhubung tanpa integrasi.

## Pengujian

- 70 tes Node dan 7 tes Python lulus, termasuk alur penilaian/akses yang sudah ada.
- Tes UI untuk kelima track memeriksa label Inggris, pengenal KPI lama, pilihan pathway, draft tersimpan dan pembacaan ulang.
- Tes enam peran memeriksa identitas Pengaturan dan penolakan pratinjau peran yang tidak dimiliki.
- Halaman publik tetap identik dengan versi asli; halaman ERP lain tetap tersedia dan hanya kehilangan pita PROTOTYPE.
- Browser QA lokal: login ringkas dan Pengaturan di lebar 360 px; tidak ada luapan horizontal setelah perbaikan.
- Backend `erp-records` v5 memakai aturan validasi pathway terbaru. Identitas, autentikasi dan otorisasi di fungsi tersebut tetap sama.

Belum menguji pengajuan melalui akun produksi nyata. QA memakai data dan namespace terisolasi, tanpa membuat akun atau catatan produksi. Bukti mobile: `review-assets/anotasi-mobile-20261103.jpg` (sisi Pengaturan menggunakan build QA lokal).
