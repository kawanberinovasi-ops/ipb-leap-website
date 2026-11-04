# Catatan anotasi — 4 November 2026

Status: tercatat untuk pembaruan berikutnya. Tiga anotasi ini belum diterapkan pada tampilan atau diuji dengan backend produksi. Kode pratinjau yang sudah dikemas tetap menjadi dasar review.

## 1. Navigasi modul cukup di dropdown atas

Hapus baris menu modul yang berulang di dalam halaman (`main#grow-app > nav.tabs`). Akses antarmodul cukup melalui satu dropdown pada navigasi atas, mengikuti peran akun:

| Peran | Dropdown atas | Isi |
|---|---|---|
| Mentee | Program | GROW Canvas, Catat Mentoring, Raport |
| Asmen | Kelompok | Kelompok, Review GROW, Review Catatan Mentee, Raport |
| Mentor | Kelompok | Kelompok, Review GROW, Review Catatan Mentee, Raport |

Berlaku konsisten pada halaman GROW, catatan mentoring, kelompok, Catat Sesi pendamping, dan Raport. Tombol tindakan di dalam isi halaman tetap tersedia, termasuk Catat Sesi dari Kelompok. Pilihan periode M3/M6/M9/M12 tetap ada di Raport karena berfungsi memilih periode, bukan navigasi modul.

Kriteria selesai frontend: tidak ada lagi menu modul ganda di isi halaman; seluruh modul masih dapat dibuka dari dropdown atas; konteks akun, track, kelompok, periode, dan mode latihan yang relevan tetap terbawa. Periksa seluruh peran pada desktop serta layar kecil.

## 2. Uji ulang pengaturan pratinjau setelah backend terhubung

Anotasi pada `aside#local-preview-controls` meminta pengujian saat backend tersedia. Ini bukan instruksi untuk menghapus alat uji lokal sekarang.

Kontrol Tampilan, Track uji, dan Coba alur penilaian tetap berfungsi sebagai alat simulasi lokal. Pada aplikasi dengan backend, peran dan penugasan harus berasal dari akun yang login. Selector pratinjau tidak boleh memberikan kewenangan akun sebenarnya.

Pengujian lanjutan yang diperlukan:

- Login sebagai mentee, Asmen, dan Mentor asli; pastikan menu, data, serta tindakan mengikuti kewenangan akun.
- Pastikan pendamping hanya melihat kelompok dan mentee yang ditugaskan, termasuk ketika membuka tautan langsung atau mengganti parameter alamat.
- Coba alur lengkap: mentee mengirim hasil → Asmen memeriksa → Mentor menilai milestone → raport diterbitkan → mentee membaca total nilai.
- Periksa penyimpanan setelah muat ulang dan akses dari akun/perangkat lain yang berwenang; uji penolakan konflik versi dan perubahan sumber setelah penilaian.
- Pastikan data latihan tetap terpisah dari data peserta dan tidak masuk perhitungan nilai sebenarnya.

Kriteria selesai integrasi: hasil diuji menggunakan backend dan akun asli; kelulusan uji role simulasi lokal saja tidak dianggap sebagai bukti pengujian ini.

## 3. Hapus kalimat pengantar Kelompok

Pada halaman Kelompok Asmen/Mentor, hapus kalimat:

> Baca GROW, pantau action, dan tanggapi kebutuhan mentee.

Judul Kelompok, identitas kelompok, informasi anggota/pendamping, data, dan tindakan tetap tersedia. Tidak perlu menyisakan paragraf kosong atau jarak tambahan bekas kalimat tersebut.

Kriteria selesai frontend: kalimat tersebut tidak muncul pada kedua peran; elemen Kelompok lainnya tetap berfungsi.

## Batas perubahan

Catatan ini tidak mengubah KPI, North Star, milestone, bobot penilaian, data, atau status publikasi. Raport terbit tetap menampilkan satu total nilai /100 sesuai perubahan sebelumnya. Belum ada push, merge, atau deployment yang dilakukan untuk anotasi ini.
