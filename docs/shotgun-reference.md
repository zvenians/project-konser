# Acuan visual dan interaksi Shotgun

Referensi utama diamati dengan Playwright pada 23 November 2026: [Shotgun](https://shotgun.live/en) dan [halaman acara aktif](https://shotgun.live/en/events/a4systemxpedro-booking). Halaman acara diperiksa pada lebar 360, 390, 768, 1024, 1280, dan 1440 piksel. Screenshot dan rekaman tersimpan lokal di `artifacts/reference/` dan sengaja diabaikan Git karena memuat karya pihak lain.

## Teramati

- Desktop: navigasi ringkas di atas; metadata acara di kiri dan cover rasio lanskap di kanan; daftar tiket langsung di bawah hero. Latar gelap dengan terang di area cover.
- Mobile: cover ditempatkan sebelum nama acara dan metadata; daftar tiket mengikuti informasi acara.
- Tiket tersedia memakai permukaan putih dan kontrol jumlah bulat `− / +`; tiket habis memakai permukaan gelap. Setelah jumlah bertambah, ringkasan pesanan muncul di kanan pada desktop dan jumlah/total berubah segera.
- Status yang diamati mencakup `Sold out`. Referensi menampilkan biaya layanan, tetapi Symphony of Faith tidak menambahkan biaya yang belum disahkan.
- Akses ke checkout referensi setelah tombol `BOOK` tidak diverifikasi, sehingga alur setelah pemilihan mengikuti kebutuhan aman Symphony of Faith: keranjang, autentikasi, reservasi atomik, verifikasi transfer, dan tiket.

## Adaptasi proyek

- Cover memakai logo resmi Symphony of Faith pada bidang warna merek. Artwork acara resmi belum tersedia; tidak ada foto atau artis rekaan.
- Venue dan livestream ditampilkan dalam dua tab karena kedua jenis tiket memiliki hak akses berbeda. Harga dan kapasitas dibaca dari database; data resmi tersimpan pada migrasi.
- Tidak ada kode promo, resale, atau fee tiruan. Tombol berbagi menggunakan Web Share API atau menyalin tautan.
- UI memakai ID/EN dengan cookie bahasa yang mempertahankan URL; keranjang browser bertahan saat halaman dimuat ulang. Sistem tema dan cabang reduced-motion khusus aplikasi telah dihapus.

Kemiripan ini berdasarkan pengamatan layar dan interaksi yang dapat diakses, bukan klaim kesamaan piksel atau kode dengan Shotgun.
