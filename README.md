# Symphony of Faith

Platform tiket dan donasi Symphony of Faith. Branch `codex/full-stack-platform` digunakan untuk Vercel Preview; jangan promosikan ke production sebelum konfigurasi pembayaran, aset tiket, dan integrasi pesan diverifikasi.

## Menjalankan lokal

1. `npm ci`
2. Salin `.env.example` ke `.env.local`, lalu isi `DATABASE_URL` PostgreSQL dan `APP_URL`.
3. `node --env-file=.env.local scripts/migrate.mjs`
4. Isi `ADMIN_EMAIL`, `ADMIN_NAME`, dan `ADMIN_PASSWORD` (minimal 16 karakter), lalu jalankan `node --env-file=.env.local scripts/create-admin.mjs`.
5. `npm run dev`

Variabel rahasia disimpan di `.env*.local` atau pengaturan environment Vercel. File tersebut diabaikan Git. Gunakan database terpisah untuk Preview dan pengujian. `scripts/prepare-preview-db.mjs` dapat menyiapkan database `sof_preview` atau `sof_test` pada server PostgreSQL yang sama; jalankan migrasi dengan `DATABASE_URL` yang sesuai.

## Operasi tiket

- Pembeli memilih jumlah tiket langsung di halaman acara. Keranjang disimpan di browser sehingga pilihan bertahan saat berpindah ke checkout, login, atau mengganti bahasa ID/EN. Server menghitung ulang harga dan stok ketika reservasi dibuat.
- Kategori dan kapasitas resmi tersimpan pada migrasi. Admin mengaktifkan penjualan dan mengatur rekening penerima dari dashboard setelah rekening resmi tersedia.
- Pembeli membuat reservasi, lalu mengirim referensi transfer. Admin atau finance memverifikasi jumlah dan referensi terhadap mutasi bank sebelum tiket diterbitkan. Referensi yang sama tidak dapat digunakan dua kali.
- Reservasi kedaluwarsa dilepas oleh endpoint `/api/cron/expire` dengan `CRON_SECRET`. Vercel Cron dikonfigurasi harian; pada Preview, jalankan endpoint secara manual karena jadwal otomatis hanya berjalan di production. Aksi reservasi dan admin juga memproses kedaluwarsa.
- PDF individual diimpor dari dashboard admin. Impor massal menerima berkas PDF dan manifest CSV dengan kolom `filename,barcode,sha256`; nilai SHA-256 harus cocok dengan isi PDF. File berada di Vercel Blob privat dan unduhan diperiksa oleh server.
- Livestream membutuhkan tiket yang sudah terverifikasi dan konfigurasi video. Tautan YouTube unlisted tetap dapat dibagikan di luar aplikasi.

## Integrasi eksternal

`BLOB_READ_WRITE_TOKEN` diperlukan untuk upload lokal. Pada Vercel, penyimpanan Blob yang terhubung dapat memakai OIDC. `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, dan template yang disetujui diperlukan untuk notifikasi WhatsApp. Outbox menyimpan status dan melakukan retry; webhook memverifikasi tanda tangan Meta. Tanpa kredensial, aplikasi tidak mengklaim pesan terkirim.

Pembayaran saat ini memakai verifikasi transfer bank manual. Tidak ada payment gateway otomatis atau bukti transaksi bank yang terhubung. Untuk mengaktifkan transaksi nyata, sediakan rekening resmi dan prosedur verifikasi operasional. PDF tiket resmi beserta manifest, kredensial WhatsApp, dan ID video livestream juga masih diperlukan.

## Verifikasi

`npm run lint`, `npm test`, `npm run build`. Pengujian browser lokal: `node scripts/visual-check.mjs`; keranjang dan bahasa: `node --env-file=.env.test-db.local scripts/cart-language-check.mjs`; alur transaksi: `node --env-file=.env.test-db.local --env-file=.env.preview-admin.local --env-file=.env.preview-cron.local scripts/e2e-check.mjs`; persaingan stok: `node --env-file=.env.test-db.local scripts/concurrency-check.mjs`. Jalankan aplikasi dengan `APP_URL=http://localhost:3220` dan `DATABASE_URL` dari `sof_test` sebelum skrip transaksi; skrip tersebut menolak database selain `sof_test`. Catatan pengamatan referensi ada di `docs/shotgun-reference.md`.
