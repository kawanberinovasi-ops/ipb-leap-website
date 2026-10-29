# Website IPB LEAP

Website publik **IPB LEAP (Leadership Acceleration Program)**, program Himpunan Alumni IPB.
*Pemimpin Melahirkan Pemimpin · Make Your Leap.*

## Struktur

| Folder / file | Isi |
|---|---|
| `src/*.dc.html` | Sumber desain tiap halaman (template + logika), hasil dari prototype desain |
| `site.config.json` | Peta halaman → URL, judul/deskripsi SEO, aset, link khusus, domain |
| `tools/build.py` | Script build: mengubah `src/` menjadi halaman statis di `docs/` |
| `docs/` | **Hasil build** yang dipublikasikan GitHub Pages |
| `docs/assets/leap-runtime.js` | Runtime kecil yang merender template & interaksi (filter, modal, animasi) |

## Halaman

`index` (Beranda) · `tentang` · `mentor` / `mentor-profil` · `asmen` / `asmen-profil` · `mentee` / `mentee-profil` · `kegiatan` · `showcase` · `prestasi` · `event` · `kontak`

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
- Tombol **Masuk** sementara mengarah ke `#masuk`; ubah di `site.config.json → links["Main.dc.html"]` ke URL IPB Leap Management System.
- Kontak: mentoringleaderhaipb@gmail.com · 0855-5907-0165 (M. Fauzan Ramdani).
