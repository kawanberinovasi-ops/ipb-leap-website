# Add GROW Canvas preview with consolidated role navigation

Menambahkan pratinjau GROW Canvas di `prototypes/grow-canvas/` untuk tujuan awal, milestone M3/M6/M9/M12, catatan mentoring, dan penilaian tiga bulanan. Navigasi modul hanya berada di dropdown atas: Mentee memakai Program (GROW Canvas, Catat Mentoring, Raport); Asmen/Mentor memakai Kelompok (Kelompok, Review GROW, Review Catatan Mentee, Raport). Menu ganda di isi halaman dan kalimat pengantar Kelompok sudah dihapus. Catat Sesi pendamping tetap tersedia dari Kelompok.

Progres, bukti, pemeriksaan Asmen, penilaian Mentor, dan hasil terbit digabung dalam Raport. Kartu raport terbit menampilkan satu total nilai /100. Mode latihan memakai database terpisah dan bisa dicoba dari hasil mentee sampai raport terbit; versi sumber, konflik perubahan, serta snapshot raport sebelumnya tetap dipertahankan.

Validasi: build 44 halaman dan pemeriksaan sintaks JavaScript berhasil; browser desktop diperiksa untuk ketiga peran, menu dropdown, perpindahan ke GROW, konteks periode, penghapusan paragraf, dan akses Catat Sesi. Sebanyak 16 pengujian model/alur telah lulus pada persiapan paket sebelumnya; perubahan anotasi ini tidak mengubah backend. Rincian dan bukti visual tersedia di `VERIFICATION.md` serta `review-assets/navigasi-dropdown-mentor.png`.

Perubahan hanya menambahkan folder prototype, tanpa menimpa source/build produksi pada akar repository. Python/SQLite dan selector role masih untuk pratinjau. Pengujian akun asli, penugasan kelompok, penyimpanan multi-pengguna, dan kewenangan backend masih menunggu integrasi; uji role simulasi bukan bukti otorisasi produksi. Pemeriksaan ponsel untuk perubahan anotasi belum dikonfirmasi. Merge PR ini menyimpan prototype di repository, bukan mengaktifkan GROW pada situs utama.
