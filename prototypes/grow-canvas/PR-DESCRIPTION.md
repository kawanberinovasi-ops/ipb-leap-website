# Add isolated GROW Canvas workflow preview

Menambahkan pratinjau GROW Canvas di `prototypes/grow-canvas/` untuk mereview tujuan awal, milestone tiga bulanan, catatan mentoring, dan alur penilaian sebelum integrasi produksi. Menu mentee berisi GROW Canvas, Catat Mentoring, dan Raport; menu pendamping berisi Kelompok, Review GROW, Review Catatan Mentee, dan Raport. Progres, bukti, penilaian, dan hasil terbit digabung dalam Raport. Kartu raport terbit menampilkan satu total nilai /100.

Mode latihan menyediakan satu kasus yang dapat dinilai Asmen dan Mentor sampai raport terbit. Penyimpanan latihan terpisah dari ruang isian biasa. Backend lokal mempertahankan versi sumber, penolakan konflik, pemeriksaan hak aksi per role simulasi, dan snapshot raport terdahulu.

Validasi: 16 pengujian model/alur lulus, build 44 halaman berhasil, pemeriksaan sintaks JavaScript lulus, alur browser telah dicoba sampai raport terbit, dan kartu total diverifikasi pada browser desktop. Catatan rinci ada di `VERIFICATION.md`.

Branch ini tidak mengubah halaman produksi pada akar `src/` atau `docs/`. API Python/SQLite dan role simulasi masih untuk pratinjau; integrasi identitas akun, penugasan, penyimpanan multi-pengguna, dan kewenangan produksi belum termasuk. Merge PR ini menyimpan prototype di repository, bukan mengaktifkan GROW pada situs utama.
