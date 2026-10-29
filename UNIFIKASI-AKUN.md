# Satu akun dan sesi untuk seluruh LMS

Login utama `app/index.html` memakai akun Supabase proyek yang sudah ada dan storage sesi `ipbleap.auth.v1` yang sama dengan penilaian. Beranda, Program, Kelompok dan modul lainnya memuat identitas terverifikasi melalui Navbar. Peran berasal dari profil server; pilihan UI tidak menambah hak akses.

`akses-penilaian.html` menjadi alamat kompatibilitas yang mengarah ke login utama, dengan tujuan semula dan hash aktivasi dipertahankan. Ketika sesi masih valid, login utama langsung menuju tujuan semula atau beranda sesuai peran. Keluar mengakhiri sesi pada browser dan tab lain yang berbagi sesi menerima peristiwa logout.

Login prototype lama sebelumnya hanya berisi tautan ke beranda, tanpa membuat sesi. Formulir tersebut disambungkan ke autentikasi yang sudah ada dengan mempertahankan layout glossy, logo dan motion. Tidak ada sistem akun kedua, akun baru, reset kata sandi, perubahan database atau perubahan RLS.

47 tes lulus, termasuk pemakaian storage yang sama, reuse sesi, tujuan aman, identitas profil server, penanganan gangguan jaringan dan isian yang tetap ada saat kata sandi salah. Browser memverifikasi login utama dan pengalihan alamat lama. Uji akun produksi dengan kredensial pengguna belum dilakukan; tes alur login memakai layanan uji. Database aktif hanya diperiksa secara read-only.
