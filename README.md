# Website IPB LEAP

Website publik **IPB LEAP (Leadership Acceleration Program)**, program Himpunan Alumni IPB.
*Pemimpin Melahirkan Pemimpin · Make Your Leap.*

## Struktur

| Folder / file | Isi |
|---|---|
| `src/public/*.dc.html` | Sumber desain website publik (template + logika) |
| `src/app/*.dc.html` | Sumber desain prototype **IPB Leap Management System** |
| `site.config.json` | Peta halaman → URL, judul/deskripsi SEO, aset, link khusus, domain |
| `tools/build.py` | Script build: mengubah `src/` menjadi halaman statis di `docs/` |
| `docs/` | **Hasil build** yang dipublikasikan GitHub Pages (`docs/app/` = Management System) |
| `docs/assets/leap-runtime.js` | Runtime kecil yang merender template & interaksi (filter, modal, animasi) |

## Halaman

`index` (Beranda) · `tentang` · `mentor` / `mentor-profil` · `asmen` / `asmen-profil` · `mentee` / `mentee-profil` · `kegiatan` · `showcase` · `prestasi` · `event` · `kontak`

## IPB Leap Management System (prototype)

Dibuka lewat tombol **Masuk** di website, atau langsung di `app/`. Di halaman masuk ada pilihan *Masuk sebagai* (Mentee, Asmen, Mentor, Pengurus, Bendahara, Super Admin).

`app/index` (Masuk & Daftar) · `beranda-mentee` · `penilaian` · `kelompok` · `monitoring-progres` · `catat-sesi` · `beranda-pengurus` · `pengumuman` · `kelola-event` · `proker` · `template` · `file-manager` · `keuangan` · `kalender` · `event` · `chat` · `pengaturan` · `super-admin`

Semua data di sini masih contoh dan belum tersambung ke database/login sungguhan. Halaman `app/` diberi `noindex` supaya tidak muncul di Google.

## Mengubah konten

1. Edit file di `src/` (atau ekspor ulang dari prototype desain).
2. Jalankan `python3 tools/build.py`.
3. Commit & push — GitHub Pages otomatis memperbarui situs.

Cek lokal: `cd docs && python3 -m http.server 8000` lalu buka http://localhost:8000.

## Menghubungkan domain sendiri

1. Isi `"cname"` dan `"url"` di `site.config.json` (mis. `"cname": "www.ipbleap.com"`), lalu build ulang — file `docs/CNAME` dibuat otomatis.
2. Di pengelola DNS domain:
   - subdomain (`www`): **CNAME** → `kawanberinovasi-ops.github.io`
   - domain utama (apex): **A** → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
3. Di GitHub: *Settings → Pages → Custom domain*, isi domain, lalu centang **Enforce HTTPS**.

## Catatan

- Foto kegiatan, prestasi, mentor, asmen, mentee, dan kata pengantar masih placeholder.
- Kontak: mentoringleaderhaipb@gmail.com · 0855-5907-0165 (M. Fauzan Ramdani).

## Review penilaian

Preview kosong dan tanpa backend tersedia pada `review-penilaian/`. Build dengan `python3 tools/build.py` lalu `python3 tools/build_review.py`. Topbar, login umum, hero dan seluruh modul selain isi penilaian tetap versi asli.

Integrasi operasional ada pada branch `integrate/assessment-20261029`; akses akun khusus penilaian berada di `app/akses-penilaian.html`, terpisah dari login prototype. SQL tambahan dan Edge belum diterapkan. Lihat `INTEGRASI-PENILAIAN.md`.
