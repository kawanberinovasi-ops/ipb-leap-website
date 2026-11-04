# Hasil pemeriksaan — 4 November 2026

- Salinan paket: 16 pengujian Python lulus, mencakup role simulasi, pengajuan, pemeriksaan, nilai nol, sumber berubah, konflik versi, pemisahan data latihan, dan snapshot raport.
- Build dari source salinan: 44 halaman berhasil dibangun.
- Pemeriksaan sintaks Node: `app.mjs`, `context.mjs`, `sessions.mjs`, dan `home.mjs` lulus.
- Launcher macOS: pemeriksaan sintaks zsh lulus; direktori kerja dihitung dari lokasi launcher, tidak menggunakan path komputer pembuat.
- Browser pada server lokal utama: kartu `#hasil-terbit` hanya mempunyai satu angka nilai, label Total nilai /100, hasil contoh 77,5. Tidak ada kolom Asmen /30 atau Mentor /70 di dalam kartu terbit.
- Bukti visual: `review-assets/raport-total-nilai.png`. Viewport desktop yang terverifikasi 1280 px. Pemeriksaan ponsel khusus kartu ini belum dikonfirmasi pada tahap pengemasan.
- Alur latihan sebelumnya diuji lewat browser: Asmen 10+10+5 → 25; Mentor 75% → 52,5; terbit → 77,5; mentee dapat membaca hasil. Perubahan kartu total hanya menyederhanakan tampilan, tanpa perubahan model penilaian.
- Export tidak menyertakan database, backup, env, kredensial, atau pola private key/token rahasia yang diperiksa. Pengujian menggunakan database sementara.
- Hanya folder `prototypes/grow-canvas/` yang ditambahkan pada branch; source dan hasil build produksi di akar repository tidak diubah.

Belum dilakukan: push ke GitHub, PR daring, merge, deployment, autentikasi multi-pengguna, koneksi data produksi, atau penerapan migrasi. GitHub Pages tidak menjalankan API Python lokal.

Pembaruan dokumentasi anotasi: `CATATAN-ANOTASI.md` mencatat tiga masukan lanjutan. Belum ada perubahan kode atau pengujian UI baru untuk masukan tersebut; hasil pemeriksaan di atas tetap merujuk kode pratinjau yang sudah ada.
